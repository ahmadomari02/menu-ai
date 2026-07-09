$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$port = 8000
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)

$contentTypes = @{
  ".css" = "text/css"
  ".html" = "text/html; charset=utf-8"
  ".js" = "application/javascript"
  ".json" = "application/json"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream] $Stream,
    [int] $StatusCode,
    [string] $StatusText,
    [byte[]] $Body,
    [string] $ContentType = "text/plain; charset=utf-8"
  )

  $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)

  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Get-ContentType {
  param([string] $Path)

  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($contentTypes.ContainsKey($extension)) {
    return $contentTypes[$extension]
  }

  return "application/octet-stream"
}

function Get-RequestPath {
  param([string] $RequestLine)

  $parts = $RequestLine -split " "
  if ($parts.Length -lt 2) {
    return "index.html"
  }

  $path = $parts[1].Split("?")[0].TrimStart("/")
  $path = [Uri]::UnescapeDataString($path)

  if ([string]::IsNullOrWhiteSpace($path)) {
    return "index.html"
  }

  return $path
}

$listener.Start()
Write-Host "Serving $root at http://localhost:$port/"
Write-Host "Press Ctrl+C to stop."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      while ($reader.Peek() -gt -1) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) {
          break
        }
      }

      $requestPath = Get-RequestPath $requestLine
      $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $requestPath))

      if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Send-Response $stream 403 "Forbidden" $body
        continue
      }

      if (-not [System.IO.File]::Exists($fullPath)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response $stream 404 "Not Found" $body
        continue
      }

      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      Send-Response $stream 200 "OK" $bytes (Get-ContentType $fullPath)
    }
    catch {
      if ($stream) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Server error")
        Send-Response $stream 500 "Internal Server Error" $body
      }
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
