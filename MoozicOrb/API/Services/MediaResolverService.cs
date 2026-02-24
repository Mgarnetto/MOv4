using Amazon.S3;
using Amazon.S3.Model;
using System;

namespace MoozicOrb.API.Services
{
    public interface IMediaResolverService
    {
        string ResolveUrl(string rawPath, int storageProvider);
    }

    public class MediaResolverService : IMediaResolverService
    {
        private readonly IAmazonS3 _s3Client;
        private const string BUCKET_NAME = "moozicorb-media";

        public MediaResolverService(IAmazonS3 s3Client)
        {
            _s3Client = s3Client;
        }

        public string ResolveUrl(string rawPath, int storageProvider)
        {
            if (string.IsNullOrEmpty(rawPath)) return "";

            // 0 = Legacy Local Server. Return the raw path so the frontend looks in wwwroot
            if (storageProvider == 0)
            {
                return rawPath;
            }

            // 1 = Cloudflare Vault. Generate a secure, 60-minute Pre-Signed URL mathematically.
            var request = new GetPreSignedUrlRequest
            {
                BucketName = BUCKET_NAME,
                Key = rawPath,
                Expires = DateTime.UtcNow.AddMinutes(60) // Ticket expires in 1 hour
            };

            return _s3Client.GetPreSignedURL(request);
        }
    }
}