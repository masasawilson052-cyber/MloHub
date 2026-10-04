Add-Type -AssemblyName System.Drawing

function Convert-Image($inputPath, $outputPath, $cropX, $cropY, $cropW, $cropH, $targetW, $targetH, $bgR, $bgG, $bgB, $bgA) {
    $src = [System.Drawing.Bitmap]::FromFile($inputPath)
    $canvas = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgA -gt 0) {
        $color = [System.Drawing.Color]::FromArgb($bgA, $bgR, $bgG, $bgB)
        $g.Clear($color)
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $destX = [int]((512 - $targetW) / 2)
    $destY = [int]((512 - $targetH) / 2)
    $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $targetW, $targetH)

    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $src.Dispose()

    if (Test-Path $outputPath) {
        Remove-Item $outputPath -Force
    }
    $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Output "Successfully saved $outputPath"
}

$baseDir = "C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo\assets\payments"

# 1. MPESA (transparent background)
Convert-Image "C:\Users\hp\Downloads\m-pesa-logo.png" "$baseDir\mpesa.png" 2 64 597 273 450 206 0 0 0 0

# 2. AIRTEL (red background #EE1C25 = 238, 28, 37)
Convert-Image "C:\Users\hp\Downloads\airtel-logo-white-text-vertical.jpg" "$baseDir\airtel-money.png" 74 62 500 502 430 432 238 28 37 255

# 3. MIXX (blue background #01377F = 1, 55, 127)
Convert-Image "C:\Users\hp\Downloads\Mixx_by_Yas-860x645-1 (1).jpg" "$baseDir\mixx-by-yas.png" 152 234 540 236 450 197 1 55 127 255

# 4. HALOPESA (transparent background)
Convert-Image "C:\Users\hp\Downloads\halopesa.png" "$baseDir\halopesa.png" 33 136 976 246 460 116 0 0 0 0
