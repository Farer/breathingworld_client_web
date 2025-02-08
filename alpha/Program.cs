var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();
app.UseRouting();
app.MapControllers();
app.UseDefaultFiles();
app.UseStaticFiles();

app.Run("http://0.0.0.0:9000");