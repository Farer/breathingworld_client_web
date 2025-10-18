using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();
// 🔧 Firefox fix: add KTX2 MIME type
var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".ktx2"] = "image/ktx2";

app.UseHttpsRedirection();
app.UseAuthorization();
app.UseRouting();
app.MapControllers();
app.UseDefaultFiles();

// ✅ apply the custom provider here
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.Run("http://0.0.0.0:9000");