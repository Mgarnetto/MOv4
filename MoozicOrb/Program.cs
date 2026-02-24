using Microsoft.AspNetCore.SignalR;
using MoozicOrb.API.Services;
using MoozicOrb.API.Services.Interfaces;
using MoozicOrb.Hubs;
using MoozicOrb.Infrastructure;
using MoozicOrb.Services;
using MoozicOrb.Services.Interfaces;
using MoozicOrb.Services.Radio;
using Amazon.S3;
using StackExchange.Redis;
using Microsoft.Extensions.FileProviders; // Required for PhysicalFileProvider

var builder = WebApplication.CreateBuilder(args);

// --- CLOUDFLARE R2 SETUP ---
var r2AccountId = builder.Configuration["CloudflareR2:AccountId"];
var r2AccessKey = builder.Configuration["CloudflareR2:AccessKey"];
var r2SecretKey = builder.Configuration["CloudflareR2:SecretKey"];

var s3Config = new AmazonS3Config
{
    ServiceURL = $"https://{r2AccountId}.r2.cloudflarestorage.com",
    ForcePathStyle = true,
};

// Register the S3 client as a Singleton so the whole app can use it
builder.Services.AddSingleton<IAmazonS3>(new AmazonS3Client(r2AccessKey, r2SecretKey, s3Config));

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddSignalR();

builder.Services.AddScoped<IMediaResolverService, MediaResolverService>();

builder.Services.AddScoped<IGroupMessageService, GroupMessageService>();
builder.Services.AddScoped<IDirectMessageService, DirectMessageService>();
builder.Services.AddScoped<IUserService, UserService>();

builder.Services.AddScoped<IUserAuthService, UserAuthService>();
builder.Services.AddScoped<ISessionStore, InMemorySessionStore>();

builder.Services.AddScoped<IGroupMessageApiService, GroupMessageApiService>();
builder.Services.AddScoped<IDirectMessageApiService, DirectMessageApiService>();

builder.Services.AddScoped<ILoginService, LoginService>();

builder.Services.AddScoped<MoozicOrb.Services.NotificationService>();

// 2. Register the Broadcaster (The Sink)
builder.Services.AddSingleton<IAudioBroadcaster, SignalRAudioBroadcaster>();

// 3. Register the Radio Station (The DJ)
builder.Services.AddHostedService<RadioStationService>();

// SignalR services 

builder.Services.AddSingleton<CallStateService>();

builder.Services.AddSingleton<UserConnectionManager>();

builder.Services.AddSingleton<IUserIdProvider, SignalRUserIdProvider>();
builder.Services.AddHttpContextAccessor();

// Register the Upload Service
builder.Services.AddScoped<IMediaFileService, MediaFileService>();
builder.Services.AddScoped<IMediaProcessor, MediaProcessor>();

builder.Services.AddSession();

// Register the Stream Service
//builder.Services.AddScoped<IStreamApiService, StreamApiService>();

// ---------------- REDIS ----------------
//builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
//{
//    var configuration = ConfigurationOptions.Parse(
//        builder.Configuration.GetConnectionString("Redis"),
//        true
//    );

//    configuration.AbortOnConnectFail = false;

//    return ConnectionMultiplexer.Connect(configuration);
//});

//// ---------------- STREAM SERVICES ----------------
//builder.Services.AddSingleton<IRedisStreamStateService, RedisStreamStateService>();
//builder.Services.AddSingleton<IStreamSessionService, StreamSessionService>();


var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

// Serves your "MoozicOrb/media" folder at the URL "/media"
//string mediaPath = Path.Combine(builder.Environment.ContentRootPath, "MoozicOrb", "media");
//if (!Directory.Exists(mediaPath)) Directory.CreateDirectory(mediaPath);

//app.UseStaticFiles(new StaticFileOptions
//{
//    FileProvider = new PhysicalFileProvider(mediaPath),
//    RequestPath = "/media"
//});

app.UseRouting();

app.UseAuthorization();

app.UseSession();

app.MapHub<GroupHub>("/GroupHub");
app.MapHub<MessageHub>("/MessageHub");
// Register the Hub Route
app.MapHub<PostHub>("/PostHub");
app.MapHub<TestStreamHub>("/hubs/teststream");

app.MapHub<StreamHub>("/StreamHub");
app.MapHub<CallHub>("/CallHub");

//app.MapControllerRoute(
//    name: "default",
//    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
