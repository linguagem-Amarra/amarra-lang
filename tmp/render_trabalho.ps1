$ErrorActionPreference = 'Stop'
$src = 'C:\Users\55639\OneDrive\Documentos\GitHub\amarra-lang\tmp\trabalho-corrigido.pptx'
$out = 'C:\Users\55639\OneDrive\Documentos\GitHub\amarra-lang\tmp\powerpoint-renders-corrigido'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($src, 1, 0, 0)
try {
  Write-Output "count=$($pres.Slides.Count)"
  for ($i=1; $i -le $pres.Slides.Count; $i++) {
    try {
      $pres.Slides.Item($i).Export((Join-Path $out "slide$i.png"), 'PNG', 1280, 720)
      Write-Output "ok=$i"
    } catch {
      Write-Output "failed=$i $($_.Exception.Message)"
    }
  }
} finally {
  $pres.Close()
  $app.Quit()
}
