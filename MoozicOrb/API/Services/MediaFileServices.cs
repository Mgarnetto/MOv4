using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;

namespace MoozicOrb.API.Services
{
    public interface IMediaFileService
    {
        Task<string> SaveFileAsync(IFormFile file, string typeFolder);
        string GetPhysicalPath(string relativePath);
        Task<string> UploadToCloudAsync(string localPhysicalPath, string objectKey);
        Task<string> UploadStreamToCloudAsync(Stream stream, string objectKey, string contentType);
        Task DeleteLocalFileAsync(string localPhysicalPath);

        // NEW: Handles Local, S3, and R2 deletion based on provider ID
        Task DeleteMediaFilesAsync(List<string> relativePaths, int storageProvider);
    }

    public class MediaFileService : IMediaFileService
    {
        private readonly IWebHostEnvironment _env;
        private readonly IAmazonS3 _s3Client;
        private const string BUCKET_NAME = "moozicorb-media";

        public MediaFileService(IWebHostEnvironment env, IAmazonS3 s3Client)
        {
            _env = env;
            _s3Client = s3Client;
        }

        public async Task<string> SaveFileAsync(IFormFile file, string typeFolder)
        {
            string uploadPath = Path.Combine(_env.WebRootPath, "media", typeFolder);
            if (!Directory.Exists(uploadPath)) Directory.CreateDirectory(uploadPath);

            string ext = Path.GetExtension(file.FileName).ToLower();
            string uniqueName = $"{Guid.NewGuid()}{ext}";
            string fullPath = Path.Combine(uploadPath, uniqueName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            return Path.Combine("media", typeFolder, uniqueName).Replace("\\", "/");
        }

        public string GetPhysicalPath(string relativePath)
        {
            return Path.Combine(_env.WebRootPath, relativePath);
        }

        public async Task<string> UploadToCloudAsync(string localPhysicalPath, string objectKey)
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = BUCKET_NAME,
                Key = objectKey,
                FilePath = localPhysicalPath,
                DisablePayloadSigning = true
            };
            await _s3Client.PutObjectAsync(putRequest);
            return objectKey;
        }

        public async Task<string> UploadStreamToCloudAsync(Stream stream, string objectKey, string contentType)
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = BUCKET_NAME,
                Key = objectKey,
                InputStream = stream,
                ContentType = contentType,
                DisablePayloadSigning = true
            };
            await _s3Client.PutObjectAsync(putRequest);
            return objectKey;
        }

        public Task DeleteLocalFileAsync(string localPhysicalPath)
        {
            try
            {
                if (System.IO.File.Exists(localPhysicalPath))
                {
                    System.IO.File.Delete(localPhysicalPath);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Cleanup Error] Failed to delete local temp file: {ex.Message}");
            }
            return Task.CompletedTask;
        }

        public async Task DeleteMediaFilesAsync(List<string> relativePaths, int storageProvider)
        {
            if (relativePaths == null || relativePaths.Count == 0) return;

            foreach (var path in relativePaths)
            {
                if (string.IsNullOrWhiteSpace(path)) continue;

                try
                {
                    // 1. THE LOCAL SWEEP (Always check local first)
                    // This is instantaneous. If a legacy file or temp upload is sitting on the server, nuke it.
                    string localPath = GetPhysicalPath(path);
                    await DeleteLocalFileAsync(localPath);

                    // 2. THE CLOUD SWEEP (Execute if flagged as S3/R2)
                    if (storageProvider == 1 || storageProvider == 2)
                    {
                        var deleteRequest = new DeleteObjectRequest
                        {
                            BucketName = BUCKET_NAME,
                            Key = path.TrimStart('/') // Prevents S3 path errors
                        };

                        // Cloudflare R2 will silently succeed even if the file is already gone, 
                        // making this incredibly safe for missing files.
                        await _s3Client.DeleteObjectAsync(deleteRequest);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Media Cleanup Error] Failed to delete {path}: {ex.Message}");
                }
            }
        }
    }
}