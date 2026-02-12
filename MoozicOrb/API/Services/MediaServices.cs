using MoozicOrb.API.Models;
using System;
using System.IO;
using System.Threading.Tasks;
using SixLabors.ImageSharp;
using NAudio.Wave;

// REMOVED: FFMediaToolkit namespaces (Video processing is now Client-Side)

namespace MoozicOrb.API.Services
{
    public interface IMediaProcessor
    {
        Task<MediaMetadata> ProcessAudioAsync(string physicalPath, string relativePath);
        Task<MediaMetadata> ProcessVideoAsync(string physicalPath, string relativePath);
        Task<MediaMetadata> ProcessImageAsync(string physicalPath, string relativePath);
    }

    public class MediaProcessor : IMediaProcessor
    {
        public async Task<MediaMetadata> ProcessAudioAsync(string physicalPath, string relativePath)
        {
            var meta = new MediaMetadata { RelativePath = relativePath };
            try
            {
                await Task.Run(() =>
                {
                    // Duration using NAudio
                    using (var reader = new AudioFileReader(physicalPath))
                    {
                        meta.DurationSeconds = (int)reader.TotalTime.TotalSeconds;
                    }

                    // 30s Snippet using NAudio
                    string snippetName = Path.GetFileNameWithoutExtension(physicalPath) + "_snippet.wav";
                    string snippetPhys = Path.Combine(Path.GetDirectoryName(physicalPath), snippetName);

                    using (var reader = new AudioFileReader(physicalPath))
                    {
                        TimeSpan cutOff = reader.TotalTime < TimeSpan.FromSeconds(30) ? reader.TotalTime : TimeSpan.FromSeconds(30);
                        WaveFileWriter.CreateWaveFile(snippetPhys, new TrimWavStream(reader, TimeSpan.Zero, cutOff));
                    }
                    meta.SnippetPath = relativePath.Replace(Path.GetFileName(physicalPath), snippetName).Replace("\\", "/");
                });
            }
            catch { meta.DurationSeconds = 0; }
            return meta;
        }

        // UPDATED: Now a lightweight stub. 
        // The Client sends us Duration/Dimensions/Thumbnail, so we don't need FFmpeg here.
        public Task<MediaMetadata> ProcessVideoAsync(string physicalPath, string relativePath)
        {
            // We return a basic object to satisfy the interface.
            // All heavy lifting is now done in feed.js or the mobile app.
            return Task.FromResult(new MediaMetadata
            {
                RelativePath = relativePath,
                DurationSeconds = 0, // Fallback/Default
                Width = 0,
                Height = 0
            });
        }

        public async Task<MediaMetadata> ProcessImageAsync(string physicalPath, string relativePath)
        {
            var meta = new MediaMetadata { RelativePath = relativePath };
            try
            {
                using (var image = await Image.LoadAsync(physicalPath))
                {
                    meta.Width = image.Width;
                    meta.Height = image.Height;
                }
            }
            catch { }
            return meta;
        }
    }

    // Helper for NAudio clipping
    public class TrimWavStream : WaveStream
    {
        private readonly WaveStream _source;
        private readonly long _start;
        private readonly long _end;
        public TrimWavStream(WaveStream source, TimeSpan start, TimeSpan end)
        {
            _source = source;
            _start = (long)(start.TotalSeconds * source.WaveFormat.AverageBytesPerSecond);
            _end = (long)(end.TotalSeconds * source.WaveFormat.AverageBytesPerSecond);
            _source.Position = _start;
        }
        public override WaveFormat WaveFormat => _source.WaveFormat;
        public override long Length => _end - _start;
        public override long Position { get => _source.Position - _start; set => _source.Position = value + _start; }
        public override int Read(byte[] buffer, int offset, int count)
        {
            long remaining = _end - _source.Position;
            if (remaining <= 0) return 0;
            return _source.Read(buffer, offset, (int)Math.Min(count, remaining));
        }
    }
}