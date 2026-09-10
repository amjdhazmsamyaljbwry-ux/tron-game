Add-Type -AssemblyName System.Drawing

function New-Icon {
    param(
        [int]$Size,
        [string]$Path
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bg = [System.Drawing.Color]::FromArgb(255, 11, 15, 26)
    $g.Clear($bg)

    [int]$margin = [double]$Size * 0.14
    [int]$rw = $Size - (2 * $margin)
    [int]$rh = $Size - (2 * $margin)
    $rect = New-Object System.Drawing.Rectangle -ArgumentList @($margin, $margin, $rw, $rh)

    $accent = [System.Drawing.Color]::FromArgb(255, 64, 196, 255)
    $penWidth = [Math]::Max(2.0, [double]$Size * 0.045)
    $pen = New-Object System.Drawing.Pen -ArgumentList @($accent, $penWidth)
    $g.DrawRectangle($pen, $rect)

    $accent2 = [System.Drawing.Color]::FromArgb(255, 105, 240, 174)
    $penWidth2 = [Math]::Max(2.0, [double]$Size * 0.07)
    $pen2 = New-Object System.Drawing.Pen -ArgumentList @($accent2, $penWidth2)
    $pen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $p1 = New-Object System.Drawing.Point -ArgumentList @([int]([double]$Size*0.30), [int]([double]$Size*0.68))
    $p2 = New-Object System.Drawing.Point -ArgumentList @([int]([double]$Size*0.30), [int]([double]$Size*0.40))
    $p3 = New-Object System.Drawing.Point -ArgumentList @([int]([double]$Size*0.55), [int]([double]$Size*0.40))
    $p4 = New-Object System.Drawing.Point -ArgumentList @([int]([double]$Size*0.55), [int]([double]$Size*0.62))
    $p5 = New-Object System.Drawing.Point -ArgumentList @([int]([double]$Size*0.72), [int]([double]$Size*0.62))
    $points = [System.Drawing.Point[]]@($p1, $p2, $p3, $p4, $p5)
    $g.DrawLines($pen2, $points)

    $headBrush = New-Object System.Drawing.SolidBrush -ArgumentList @($accent2)
    [double]$hs = [double]$Size * 0.10
    $ex = [double]([double]$Size*0.72 - $hs/2)
    $ey = [double]([double]$Size*0.62 - $hs/2)
    $g.FillEllipse($headBrush, [float]$ex, [float]$ey, [float]$hs, [float]$hs)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$dir = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-Icon -Size 192 -Path (Join-Path $dir "icon-192.png")
New-Icon -Size 512 -Path (Join-Path $dir "icon-512.png")

Write-Output "done"
Get-ChildItem $dir
