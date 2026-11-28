# Sponsoren-Rotation implementieren

Implementiere eine automatische Rotation für die Sponsorenanzeige, da aktuell zu viele Sponsoren gleichzeitig nebeneinander angezeigt werden.

## Vorgegebene Methodenköpfe (verbindlich)

- `getVisibleSponsors(sponsors, visibleCount, currentIndex)`
- `rotateSponsors(currentIndex, totalSponsors, visibleCount)`
- `shouldRotateSponsors(totalSponsors, visibleCount)`
- `startSponsorRotation(callback, interval)`
- `stopSponsorRotation(timer)`
- `pauseSponsorRotation()`
- `resumeSponsorRotation()`

## Anforderungen und Vitest

- Maximal 3 Sponsoren gleichzeitig anzeigen, responsiv angepasst.
- Sponsoren automatisch und gleichmäßig mit fließenden Übergängen rotieren lassen.
- Nach dem letzten Sponsor wieder von vorne beginnen.
- Bei wenigen Sponsoren keine Rotation durchführen.
- Rotation bei Mouseover oder Interaktion pausieren und fortsetzen.
- Bestehende Sponsoren-Daten und Verknüpfungen erhalten.
- Für alle vorgegebenen Methoden eigene Vitest-Tests erstellen.
- Sichtbarkeit, Rotation, Endlosschleife, Pause, Fortsetzung und Stopp testen.
- Zeitabhängige Tests mit `vi.useFakeTimers()` durchführen.

## Vorgehensweise

- Bestehende Sponsoren-Komponente analysieren.
- Vorgegebene Methoden implementieren und integrieren.
- Passende Vitest-Tests selbstständig erstellen.
- Erst nach vollständiger Implementierung alle Tests ausführen.
- Fehler beheben und Tests erneut ausführen.
- Bestehende Funktionen und Verknüpfungen dürfen nicht beeinträchtigt werden.