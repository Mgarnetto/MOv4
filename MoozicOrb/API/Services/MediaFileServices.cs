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

        // Cloudflare R2 Pipeline
        Task<string> UploadToCloudAsync(string localPhysicalPath, string objectKey);
        Task<string> UploadStreamToCloudAsync(Stream stream, string objectKey, string contentType);
        Task DeleteLocalFileAsync(string localPhysicalPath);
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
    }
}