using MoozicOrb.API.Models;
using System;
using System.IO;
using System.Threading.Tasks;
using NAudio.Wave;

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
                    using (var reader = new AudioFileReader(physicalPath))
                    {
                        meta.DurationSeconds = (int)reader.TotalTime.TotalSeconds;
                    }

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

        public Task<MediaMetadata> ProcessVideoAsync(string physicalPath, string relativePath)
        {
            return Task.FromResult(new MediaMetadata
            {
                RelativePath = relativePath,
                DurationSeconds = 0,
                Width = 0,
                Height = 0
            });
        }

        public async Task<MediaMetadata> ProcessImageAsync(string physicalPath, string relativePath)
        {
            var meta = new MediaMetadata { RelativePath = relativePath };
            try
            {
                // Disambiguated Image Load
                using (var image = await SixLabors.ImageSharp.Image.LoadAsync(physicalPath))
                {
                    meta.Width = image.Width;
                    meta.Height = image.Height;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Image Processor Error]: {ex.Message}");
            }
            return meta;
        }
    }

    // Refactored with strict BlockAlignment to prevent audio corruption
    public class TrimWavStream : WaveStream
    {
        private readonly WaveStream _sourceStream;
        private readonly long _startPosition;
        private readonly long _endPosition;

        public TrimWavStream(WaveStream sourceStream, TimeSpan startTime, TimeSpan endTime)
        {
            _sourceStream = sourceStream;

            long rawStart = (long)(startTime.TotalSeconds * sourceStream.WaveFormat.AverageBytesPerSecond);
            long rawEnd = (long)(endTime.TotalSeconds * sourceStream.WaveFormat.AverageBytesPerSecond);

            // Align strictly to Block Boundaries
            _startPosition = rawStart - (rawStart % sourceStream.WaveFormat.BlockAlign);
            _endPosition = rawEnd - (rawEnd % sourceStream.WaveFormat.BlockAlign);

            _sourceStream.Position = _startPosition;
        }

        public override WaveFormat WaveFormat => _sourceStream.WaveFormat;
        public override long Length => _endPosition - _startPosition;

        public override long Position
        {
            get => _sourceStream.Position - _startPosition;
            set => _sourceStream.Position = value + _startPosition;
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            long bytesRemaining = _endPosition - _sourceStream.Position;
            if (bytesRemaining <= 0) return 0;

            int bytesToRead = (int)Math.Min(count, bytesRemaining);
            return _sourceStream.Read(buffer, offset, bytesToRead);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _sourceStream?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}