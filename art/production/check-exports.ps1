Add-Type -AssemblyName System.Drawing
$rows=@()
$manifest=Get-Content art/production/manifest.json -Raw | ConvertFrom-Json
foreach($entry in $manifest){$file=Get-Item -LiteralPath ('public/ui/'+$entry.name+'.jpg');$image=[System.Drawing.Bitmap]::new($file.FullName);if($image.Width -ne 640 -or $image.Height -ne 640 -or $file.Length -gt 153600){throw ('Invalid image '+$entry.name)};$rows+=@{name=$entry.name;width=$image.Width;height=$image.Height;bytes=$file.Length};$image.Dispose()}
foreach($file in Get-ChildItem public/ui/kit -File){$image=[System.Drawing.Bitmap]::new($file.FullName);if($image.GetPixel(0,0).A -gt 8){throw ('No transparent corner '+$file.Name)};$rows+=@{name=$file.BaseName;width=$image.Width;height=$image.Height;bytes=$file.Length;cornerAlpha=$image.GetPixel(0,0).A};$image.Dispose()}
$rows | ConvertTo-Json | Set-Content art/production/exports.json
Write-Output ($rows.Count.ToString()+' assets: dimensions, file sizes and transparent PNG corners checked')
