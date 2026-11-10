$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing.Common,System.Drawing.Primitives -TypeDefinition @'
using System;using System.Drawing;
public static class ArtBounds {
 public static Rectangle Alpha(Bitmap b){int l=b.Width,t=b.Height,r=-1,d=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++){if(b.GetPixel(x,y).A>8){l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);d=Math.Max(d,y);}}if(r<0)throw new Exception("Empty image");l=Math.Max(0,l-2);t=Math.Max(0,t-2);r=Math.Min(b.Width-1,r+2);d=Math.Min(b.Height-1,d+2);return new Rectangle(l,t,r-l+1,d-t+1);}
}
'@
$projectRoot=Split-Path -Parent $PSScriptRoot
$sizes=@{'panel'=@(768,768);'plaque'=@(640,160);'button-primary'=@(320,128);'button-secondary'=@(320,128);'card'=@(384,384);'hud'=@(320,160);'close'=@(128,128)}
foreach($sourceFile in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'generated-sources') -Filter 'kit-*.png'){
 $name=$sourceFile.BaseName.Substring(4)
 $destination=Join-Path (Split-Path -Parent $projectRoot) ('public/ui/kit/'+$name+'.png')
 $size=if($sizes.ContainsKey($name)){$sizes[$name]}else{@(128,128)}
 $inputImage=[System.Drawing.Bitmap]::new($sourceFile.FullName)
 $bounds=[ArtBounds]::Alpha($inputImage)
 $canvas=[System.Drawing.Bitmap]::new($size[0],$size[1],[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::Transparent)
 $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 if($name -eq 'panel' -or $name -eq 'card'){
  # Export neuf tranches : les ornements restent dans les marges de coins prévues.
  $sourceCorner=[int]([Math]::Min($bounds.Width,$bounds.Height)*.27)
  $targetCorner=if($name -eq 'panel'){96}else{48}
  $sx=@($bounds.X,($bounds.X+$sourceCorner),($bounds.Right-$sourceCorner),$bounds.Right)
  $sy=@($bounds.Y,($bounds.Y+$sourceCorner),($bounds.Bottom-$sourceCorner),$bounds.Bottom)
  $dx=@(0,$targetCorner,($size[0]-$targetCorner),$size[0]);$dy=@(0,$targetCorner,($size[1]-$targetCorner),$size[1])
  for($y=0;$y -lt 3;$y++){for($x=0;$x -lt 3;$x++){$dest=[System.Drawing.Rectangle]::new($dx[$x],$dy[$y],($dx[$x+1]-$dx[$x]),($dy[$y+1]-$dy[$y]));$g.DrawImage($inputImage,$dest,$sx[$x],$sy[$y],($sx[$x+1]-$sx[$x]),($sy[$y+1]-$sy[$y]),[System.Drawing.GraphicsUnit]::Pixel)}}
 }elseif($name.StartsWith('icon-') -or $name -eq 'close'){
  $ratio=[Math]::Min(112/$bounds.Width,112/$bounds.Height);$w=[int]($bounds.Width*$ratio);$h=[int]($bounds.Height*$ratio)
  $dest=[System.Drawing.Rectangle]::new([int](($size[0]-$w)/2),[int](($size[1]-$h)/2),$w,$h);$g.DrawImage($inputImage,$dest,$bounds,[System.Drawing.GraphicsUnit]::Pixel)
 }else{$g.DrawImage($inputImage,[System.Drawing.Rectangle]::new(0,0,$size[0],$size[1]),$bounds,[System.Drawing.GraphicsUnit]::Pixel)}
 $canvas.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
 $g.Dispose();$canvas.Dispose();$inputImage.Dispose()
 Write-Output $name
}
