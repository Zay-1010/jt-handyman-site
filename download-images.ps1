# download-images.ps1
# Downloads all images currently loaded live from lp.jthandymansolutionz.com.au
# and saves them into the correct local folders (img/work/ and img/).

$base = "https://lp.jthandymansolutionz.com.au/assets/img/jt-site"

New-Item -ItemType Directory -Force -Path "img/work" | Out-Null

$workFiles = @(
  "jt-room-prep-melbourne.webp",
  "jt-room-prep-melbourne.jpg",
  "jt-finished-bathroom-vanity-melbourne.webp",
  "jt-finished-bathroom-vanity-melbourne.jpg",
  "jt-stainless-stair-handrail-melbourne.jpg",
  "jt-grey-gate-carpentry-melbourne.jpg",
  "jt-timber-pool-deck-melbourne.webp",
  "jt-timber-pool-deck-melbourne.jpg",
  "jt-bathroom-cabinet-nook-melbourne.jpg",
  "jt-bathroom-cabinet-nook-melbourne.webp",
  "jt-tiled-shower-glass-screen-melbourne.jpg",
  "jt-tiled-shower-glass-screen-melbourne.webp",
  "jt-black-framed-window-melbourne.jpg",
  "jt-modern-facade-cladding-melbourne.jpg",
  "jt-tiled-shower-feature-strip-melbourne.jpg",
  "jt-tiled-shower-feature-strip-melbourne.webp",
  "jt-door-handle-install-melbourne.jpg",
  "jt-finished-timber-floor-melbourne.jpg",
  "jt-finished-timber-floor-melbourne.webp",
  "jt-laminate-flooring-melbourne.jpg",
  "jt-period-hallway-arch-melbourne.jpg",
  "jt-vj-panelling-shelves-melbourne.jpg",
  "jt-kitchen-sink-gooseneck-tap-melbourne.jpg",
  "jt-new-timber-fence-melbourne.jpg",
  "jt-finished-shower-dark-tile-melbourne.jpg",
  "jt-finished-shower-dark-tile-melbourne.webp",
  "jt-vinyl-floor-room-melbourne.jpg",
  "jt-painted-brick-garden-wall-melbourne.jpg",
  "jt-brick-townhouse-exterior-melbourne.jpg",
  "jt-verandah-bracket-carpentry-melbourne.jpg",
  "jt-hallway-glass-door-courtyard-melbourne.jpg",
  "jt-hallway-glass-door-courtyard-melbourne.webp",
  "jt-timber-look-flooring-melbourne.webp",
  "jt-verandah-posts-carpentry-melbourne.jpg",
  "jt-verandah-posts-carpentry-melbourne.webp",
  "jt-dark-slat-fence-melbourne.jpg",
  "jt-kitchen-drawers-cooktop-melbourne.jpg"
)

$topFiles = @(
  "jt-svc-kitchen.jpg",
  "jt-property-repair-melbourne-4.webp",
  "jabez-jt-handyman-founder.webp",
  "jabez-jt-handyman-founder.jpg",
  "jt-carpentry-melbourne.webp",
  "jt-painting-melbourne.webp",
  "jt-window-repairs-melbourne.webp",
  "jt-real-estate-works-melbourne.webp",
  "jt-property-repair-melbourne-2.webp",
  "jt-5year-guarantee-badge.png"
)

Write-Host "Downloading 37 files into img/work/ ..."
foreach ($f in $workFiles) {
  $url = "$base/work/$f"
  $dest = "img/work/$f"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -ErrorAction Stop
    Write-Host "OK: $f"
  } catch {
    Write-Host "FAILED: $f -- $($_.Exception.Message)"
  }
}

Write-Host "Downloading 10 files into img/ ..."
foreach ($f in $topFiles) {
  $url = "$base/$f"
  $dest = "img/$f"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -ErrorAction Stop
    Write-Host "OK: $f"
  } catch {
    Write-Host "FAILED: $f -- $($_.Exception.Message)"
  }
}

Write-Host "Done. Check the output above for any FAILED lines."