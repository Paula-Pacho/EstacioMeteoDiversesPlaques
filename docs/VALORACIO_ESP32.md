# Valoració: estacions meteorològiques amb ESP32

*Document de treball · 22 d'octubre de 2026 · Projecte Meteo:bit (mentoria 4.0)*

> Els preus, límits de ThingSpeak i compatibilitats de programari d'aquest document són **orientatius i no s'han verificat avui**. Cal comprovar-los abans de comprar o fer comandes (vegeu l'apartat 12).

## 1. Resum i recomanació

**Recomanació: sí, val la pena fer el salt a l'ESP32, però com a pilot en una sola escola i mantenint ThingSpeak i el dashboard actuals.** El canvi no és de web sinó de maquinari: l'ESP32 té Wi-Fi integrat, més memòria i més potència que el conjunt micro:bit + mòdul Wi-Fi, i permet afegir sensors (pluja, pols, bateria) sense canviar de plataforma.

Per no complicar-ho, el pla és:

1. **Mantenir ThingSpeak** com a porta d'entrada de les dades (la web ja el sap llegir i l'històric s'arxiva al full de càlcul).
2. **Unificar els camps** (`field1…field8`) per a totes les estacions noves (apartat 6).
3. Fer un **pilot de 4–6 setmanes** a una escola, amb l'estació micro:bit i l'ESP32 funcionant en paral·lel per comparar dades.
4. Decidir l'escalat només després del pilot.

## 2. Punt de partida (què hi ha avui)

- Estacions amb **micro:bit + kit amb Wi-Fi** (el codi menciona ELECFREAKS) que envien a **ThingSpeak**, un canal per escola.
- El dashboard (GitHub Pages) llegeix **directament de ThingSpeak** des del navegador.
- Camps habituals: temperatura, humitat, lluminositat, pressió i vent. El vent arriba en **cm/h** i el dashboard el divideix per 100.
- Dues escoles (Mar i Cel, Mas i Perera) tenen **altres camps** (p. ex. pols, sense vent). Cada estació té el seu propi mapa de camps (ara definit per perfil de placa a `js/boards.js`).
- L'estació d'El Castellot envia una lectura cada **~20 s**, cosa que genera molts punts i s'acosta als límits del compte gratuït (vegeu l'apartat 5).
- Només 4 de 7 escoles tenen canal configurat.

## 3. Per què ESP32 (i per què no)

| A favor | En contra |
|---|---|
| Wi-Fi i Bluetooth integrats; sense mòdul addicional | Només **Wi-Fi 2,4 GHz** (no funciona a xarxes només de 5 GHz) |
| Potència i memòria de sobres per sensors, mitjanes i reconnexió | Entrades analògiques (ADC) poc lineals i de **3,3 V màxim** |
| Molt barat i fàcil de trobar | Més soldadura i cablejat que els mòduls plug-and-play del micro:bit |
| Es programa amb blocs, MicroPython o Arduino | Cal gestionar la **xarxa del centre** (apartat 7) |
| Actualitzacions per aire (OTA) i mode de baix consum | Menys «autocontingut» per a alumnat de primària |
| Permet ampliar: pluviòmetre, pols, bateria, GPS… | Cal formar el professorat en un entorn nou |

**Lectura didàctica:** el micro:bit continua sent excel·lent per a primària. L'ESP32 encaixa millor a **cicle superior, ESO, Batxillerat i FP**, o com a «segona fase» del projecte per a centres que ja dominen el micro:bit.

## 4. Placa recomanada

| Opció | Quan triar-la |
|---|---|
| **ESP32 DevKit (WROOM-32)** | Opció per defecte: més tutorials, més llibreries i més exemples. |
| **ESP32-S3** | Si es vol una placa més nova amb més marge; mateixa programació en la pràctica. |
| **ESP32-C3** | Estació senzilla i molt barata (pocs sensors); un sol nucli. |
| **Placa amb gestió de bateria (tipus FireBeetle / LOLIN)** | Estacions solars o sense endoll. |

Per al pilot: **ESP32 DevKit clàssic**, amb pins ben etiquetats i molta documentació.

## 5. Sensors i muntatge

| Magnitud | Sensor suggerit | Notes |
|---|---|---|
| Temperatura, humitat, pressió | **BME280** (I²C) | Un BMP280 **no** mesura humitat. Evitar el DHT22 si es pot (menys precís). |
| Llum | **BH1750** (lux) o LDR | La LDR dóna un valor relatiu (%), no lux. |
| Vent | Anemòmetre de **pulsos** (reed) | Més fiable que els de sortida analògica; es compten pulsos per interrupció. |
| Pluja | Pluviòmetre de **cassoleta basculant** | També per pulsos; cal calibrar mm per basculada. |
| Pols (PM2.5/PM10) | Sensor làser tipus PMS5003 | Opcional; ja es fa servir a Mar i Cel. |
| Bateria / senyal | Divisor de tensió + RSSI | Útil per diagnosticar estacions caigudes. |

**Bones pràctiques de muntatge**
- Posar el BME280 en una **pantalla de radiació** (tipus Stevenson) i lluny de l'electrònica, que l'escalfa.
- Caixa estanca (IP65 o similar) i **assecant** per evitar condensació.
- Fer **mediana de diverses mostres** abans d'enviar i descartar valors fora de rang.
- Calibrar contra una referència (estació propera o termòmetre fiable) durant el pilot.

## 6. Convenció de camps recomanada

Perquè la web, l'arxiu al full de càlcul i el firmware parlin el mateix idioma, es proposa aquest mapa per a **totes les estacions noves**:

| Camp | Magnitud | Unitat |
|---|---|---|
| field1 | Temperatura | °C |
| field2 | Humitat relativa | % |
| field3 | Lluminositat | lux |
| field4 | Pressió | hPa |
| field5 | Vent | **km/h** |
| field6 | Pluja acumulada | mm |
| field7 | Pols PM2.5 | µg/m³ |
| field8 | Diagnòstic: senyal Wi-Fi (RSSI) o bateria | dBm / V |

**Important:** els kits micro:bit envien el vent en cm/h. L'ESP32 ha d'enviar **km/h**, i el perfil **ESP32** ja ho tracta amb `scale: 1` (el perfil micro:bit fa `scale: 0.01`). Així les dues generacions d'estació poden coexistir.

## 7. Connectivitat al centre (el risc principal)

- **Només 2,4 GHz.** Verificar que la xarxa del centre l'ofereix a la zona on anirà l'estació.
- Algunes xarxes escolars tenen **portal captiu**, filtratge per MAC o accés restringit. L'ESP32 suporta WPA2-Enterprise, però complica el firmware.
- **Cal parlar amb el coordinador digital/TAC** de cada centre abans: xarxa a utilitzar, si cal registrar el dispositiu i si el tallafoc deixa sortir al port 80/443 cap a `api.thingspeak.com`.
- Si no hi ha Wi-Fi a l'exterior, les alternatives són un **punt d'accés/repetidor** o un **hotspot mòbil** per al pilot. LoRaWAN seria un altre projecte.
- Recomanat: que l'alumnat/professorat configuri el Wi-Fi des d'un **portal de configuració** (apartat 9) i no escrivint la contrasenya al codi.

## 8. Servidor de dades

**Fase 1 (recomanada): ThingSpeak, enviant per HTTP.** El dashboard no canvia.

Punts a vigilar (comprovar a la pàgina de llicència de ThingSpeak):
- Interval mínim d'escriptura al compte gratuït (≈15 s) i **quota anual de missatges**. A 20 s, un canal genera ~1,6 milions de missatges l'any; a **60 s són ~525.000**.
- Nombre de **canals per compte**: amb 7 escoles cal repartir-los o valorar un compte de pagament educatiu.
- Retenció i accés públic/privat del canal: un canal **privat** necessita clau de lectura al navegador, i aquesta queda visible; un canal **públic** no en necessita.

**Recomanació:** enviar **cada 60 s** (o cada 5 min en estacions amb bateria). Per a meteorologia escolar és suficient i redueix 3× la càrrega.

**Fase 2 (opcional, si ThingSpeak es queda curt):** servidor propi lleuger (p. ex. Raspberry Pi o un servei gestionat amb base de dades de sèries temporals) o MQTT amb un *broker*. Compte: no és trivial de mantenir en un entorn educatiu; només si hi ha un equip que se'n faci càrrec.

> L'ESP32 no ha d'escriure mai directament al repositori de GitHub: el repositori només arxiva (cada hora, via GitHub Actions) i serveix la web.

## 9. Firmware: què hauria d'incloure

1. **Configuració de Wi-Fi per portal captiu** (SSID, contrasenya, clau d'escriptura) sense recompilar.
2. **Clau d'escriptura fora del codi** (fitxer `secrets` no pujat a git; afegir-lo a `.gitignore`).
3. **Reconnexió automàtica** i *watchdog*: si falla el Wi-Fi o el penja el programa, es reinicia sol.
4. **Mediana de mostres** i filtre de valors absurds.
5. **Enviament amb reintents** i control de l'interval (no més sovint que el límit).
6. **OTA** (actualització per Wi-Fi) per no haver de pujar a la teulada.
7. **Diagnòstic al `field8`** (RSSI o bateria) per saber *per què* una estació ha deixat d'enviar.
8. Un identificador d'estació i versió del firmware als logs.

**Entorns de programació segons el nivell:**
- **MicroBlocks** (blocs) o **MicroPython/Thonny**: ESO i cicle superior; corba d'aprenentatge suau.
- **Arduino IDE / PlatformIO (C++)**: Batxillerat, FP i professorat amb experiència.
- Verificar que la versió escollida suporta la placa i les llibreries dels sensors concrets abans de fixar el material didàctic.

## 10. Alimentació

- **A l'interior o amb endoll:** font USB de 5 V/1 A. És el més senzill per al pilot.
- **A l'exterior sense endoll:** panell solar + bateria Li-ion + carregador, i **deep sleep** entre lectures. Les plaques de desenvolupament consumeixen molt en repòs per culpa dels LEDs i del regulador; per a bateria triar plaques pensades per a baix consum.
- El Wi-Fi té **pics de consum** de diverses desenes a centenars de mA: dimensionar bé font i cables.

## 11. Cost orientatiu per estació

*(Estimació; no verificada amb preus actuals.)*

| Concepte | Interval aproximat |
|---|---|
| Placa ESP32 | 4–10 € |
| BME280 | 2–6 € |
| Anemòmetre + pluviòmetre (kit meteo) | 20–45 € |
| Llum (BH1750/LDR), cablejat, connectors | 3–8 € |
| Caixa estanca + pantalla de radiació | 8–20 € |
| Font d'alimentació / solar | 5–30 € |
| **Total orientatiu** | **≈ 40–120 €** |

El cost ve sobretot de l'anemòmetre/pluviòmetre i del muntatge exterior, no de l'ESP32.

## 12. Riscos i mitigacions

| Risc | Mitigació |
|---|---|
| Xarxa del centre bloqueja l'estació | Parlar amb el coordinador TAC **abans** de comprar; plaques de prova a l'escola pilot. |
| Humitat/condensació i pluja malmeten l'electrònica | Caixa IP65, assecant, premsaestopes, prova d'un mes. |
| Mesures errònies (calor del sol, mala calibració) | Pantalla de radiació, calibratge contra referència, rang de validació. |
| Claus filtrades en pujar codi a git | Fitxer `secrets` fora del repositori; regenerar les claus que ja hi són. |
| Superar límits de ThingSpeak | Enviar cada 60 s o més; repartir canals; revisar la llicència. |
| Dependència d'una sola persona | Guia pas a pas + plantilla de firmware + BOM al repositori. |
| Dades personals | L'estació no recull dades personals (cap càmera ni micròfon); mantenir-ho així. |

## 13. Pla de pilot (4–6 setmanes)

| Fase | Durada | Què es fa | Criteri d'èxit |
|---|---|---|---|
| 0. Preparació | 1 setmana | Triar escola pilot, parlar amb coordinador TAC, comprar material | Wi-Fi 2,4 GHz confirmat a l'ubicació |
| 1. Banc de proves | 1 setmana | ESP32 + BME280 enviant a un canal de prova | Lectures estables 48 h |
| 2. Paral·lel | 2–4 setmanes | Estació ESP32 al costat de la micro:bit | Diferència de temperatura < ±0,5 °C i humitat < ±3 % respecte a la referència |
| 3. Exterior | 1–2 setmanes | Caixa estanca, anemòmetre i pluviòmetre | Zero reinicis inesperats en 7 dies |
| 4. Decisió | — | Valorar cost, manteniment, feedback docent | Decisió d'escalar o no |

## 14. Com encaixa a la web actual

La web ja és independent de la placa. Per afegir una estació ESP32 només cal:

1. Que l'ESP32 enviï a un canal de ThingSpeak **públic** amb el mapa de camps de l'apartat 6 (vent en **km/h**).
2. Donar-la d'alta a `alta.html` amb el perfil **ESP32** (o «personalitzada» si els camps són diferents). No cal tocar cap codi.
3. Aprovar-la al full de càlcul. L'estació surt al mapa i l'històric s'hi arxiva cada hora.

La web ja entén `rain`, `dust`, `battery` i `signal`, a més de temperatura, humitat, llum, pressió i vent. El mapa permet triar temperatura, humitat, llum, pressió, vent, pluja i pols.

**Pendents quan arribin les primeres estacions ESP32:**
- Mostrar la pluja com a **barres** acumulades en lloc de línia.
- Un indicador d'«en línia» que tingui en compte l'interval d'enviament de cada estació.

## 15. Decisions i dades que falten

1. **Quin maquinari hi ha ara a cada escola?** (kit exacte, estat dels sensors).
2. **Quantes escoles passarien a ESP32?** Defineix canals, pressupost i suport.
3. **Pressupost per estació** i qui el cobreix.
4. **Nivell de l'alumnat** que farà el muntatge (decideix blocs vs. codi).
5. **Quin compte(s) de ThingSpeak es faran servir** i quins límits tenen.
6. **Escola pilot** i persona de contacte TAC.

*Proposta:* si les respostes 1, 4 i 6 són clares, el pilot pot començar en 2 setmanes.
