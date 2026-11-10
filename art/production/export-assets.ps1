param([switch]$Kit)
Add-Type -AssemblyName System.Drawing
$projectRoot=Split-Path -Parent $PSScriptRoot
$sourceDirectory=Join-Path $projectRoot 'generated-sources'
$jpegCodec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$encoderParams=[System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParams.Param[0]=[System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]87)
foreach($sourceFile in Get-ChildItem -LiteralPath $sourceDirectory -Filter 'menu-*.png'){
 $destination=Join-Path (Split-Path -Parent $projectRoot) ('public/ui/'+$sourceFile.BaseName+'.jpg')
 if(Test-Path -LiteralPath $destination){continue}
 $inputImage=[System.Drawing.Image]::FromFile($sourceFile.FullName)
 $canvas=[System.Drawing.Bitmap]::new(640,640)
 $graphics=[System.Drawing.Graphics]::FromImage($canvas)
 $graphics.Clear([System.Drawing.Color]::White)
 $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $graphics.DrawImage($inputImage,0,0,640,640)
 $canvas.Save($destination,$jpegCodec,$encoderParams)
 $graphics.Dispose();$canvas.Dispose();$inputImage.Dispose()
}
$encoderParams.Dispose()
