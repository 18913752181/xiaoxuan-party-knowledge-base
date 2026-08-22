$ErrorActionPreference = 'Stop'
$inputPath = 'C:\Users\17433\Desktop\xiaoxuan-party-knowledge-base\miniprogram\config\education-bases.json'
$outputPath = 'C:\Users\17433\Desktop\xiaoxuan-party-knowledge-base\research\education-geocode-osm.json'
$bases = Get-Content -LiteralPath $inputPath -Raw -Encoding utf8 | ConvertFrom-Json
$areaHints = @{
  '常熟'='常熟市 苏州市 江苏省'; '高新区'='虎丘区 苏州市 江苏省'; '姑苏'='姑苏区 苏州市 江苏省'
  '嘉兴'='嘉兴市 浙江省'; '昆山'='昆山市 苏州市 江苏省'; '上海'='上海市'; '太仓'='太仓市 苏州市 江苏省'
  '无锡'='无锡市 江苏省'; '吴江'='吴江区 苏州市 江苏省'; '吴中'='吴中区 苏州市 江苏省'
  '相城'='相城区 苏州市 江苏省'; '园区'='苏州工业园区 苏州市 江苏省'; '张家港'='张家港市 苏州市 江苏省'
}
New-Item -ItemType Directory -Force -Path (Split-Path $outputPath) | Out-Null
$results = [System.Collections.Generic.List[object]]::new()
foreach ($base in $bases) {
  $query = "$($base.name) $($areaHints[$base.area])"
  $url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=' + [uri]::EscapeDataString($query)
  $matches = @()
  $errorText = ''
  try {
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 15 -Headers @{'User-Agent'='XiaoxuanEducationMap/1.0 (xiaoxuanvip.com)'}
    $matches = @($response)
  } catch {
    $errorText = $_.Exception.Message
  }
  $results.Add([pscustomobject]@{id=$base.id; name=$base.name; area=$base.area; query=$query; sourceUrl=$url; matches=$matches; error=$errorText})
  if (($results.Count % 10) -eq 0 -or $results.Count -eq $bases.Count) {
    $results | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $outputPath -Encoding utf8
    Write-Output "$($results.Count)/$($bases.Count) complete, matched $(@($results | Where-Object {$_.matches.Count -gt 0}).Count)"
  }
  Start-Sleep -Milliseconds 1100
}

