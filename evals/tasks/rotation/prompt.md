# Feature: Automatische Sponsoren-Rotation

Implementiere eine automatische Rotation für die Sponsorenanzeige, da aktuell zu viele Sponsoren gleichzeitig nebeneinander angezeigt werden.

## Dateipfade

- **Sponsor-Daten:** `app/lib/data/sponsoren.ts`
- **Zu erweiternde Komponente:** `app/components/SponsorenListe.tsx`

## Datenstruktur

```typescript
export interface Sponsor {
  name: string;
  logo: string;
  website: string;
}
```

## Verbindliche Methodenköpfe

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
- Bestehende Sponsor-Daten und Verknüpfungen erhalten.
- Barrierefreiheit und Performance berücksichtigen.

## Vorgehensweise

- Bestehende Sponsoren-Komponente und Datenstruktur analysieren.
- Vorgegebene Methoden implementieren und integrieren.
- Bestehende Funktionen nicht beeinträchtigen.
- Implementierung vollständig abschließen, bevor Tests ausgeführt werden.
- Anschließend die bereitgestellten automatisierten Vitest-Tests ausführen.
- Fehler beheben und Tests erneut ausführen.