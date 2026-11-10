Add-Type -AssemblyName System.Drawing
foreach($mode in @('walk','taxi','yonga','moto')){
 $inputImage=[System.Drawing.Image]::FromFile((Join-Path $PWD ('art/generated-sources/transport-'+$mode+'-respo.png')))
 $canvas=[System.Drawing.Bitmap]::new(768,768);$g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::White);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$g.DrawImage($inputImage,0,0,768,768)
 $canvas.Save((Join-Path $PWD ('public/ui/transport-'+$mode+'.png')),[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$canvas.Dispose();$inputImage.Dispose()
}
