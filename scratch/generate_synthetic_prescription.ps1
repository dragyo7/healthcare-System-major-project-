Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 800, 400
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font('Arial', [float]18, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font('Arial', [float]14, [System.Drawing.FontStyle]::Regular)
$brush = [System.Drawing.Brushes]::Black
$g.DrawString('Rx CLINICAL PRESCRIPTION', $font, $brush, [float]50, [float]40)
$g.DrawString('Patient: Aarav Patil', $subFont, $brush, [float]50, [float]80)
$g.DrawString('1. Amlodipine 5mg OD oral for 30 days with water', $subFont, $brush, [float]50, [float]130)
$g.DrawString('2. Atorvastatin 20mg daily for 30 days at bedtime', $subFont, $brush, [float]50, [float]170)
$g.DrawString('Dr. Rahul Sharma, MD Cardiology', $subFont, $brush, [float]50, [float]240)
$outPath = 'E:\Major Project Code\scratch\synthetic_prescription_test.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Generated synthetic prescription PNG successfully at $outPath"
