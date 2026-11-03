# Romanian ECG language: style guide and glossary

*Built 2026-10-13 from five research passes over about 40 Romanian sources (university courses, textbooks, the Romanian ESC guideline translations, SRC's Revista Rezidentului, nursing material), then checked by an independent verifier. The verifier's corrections are applied below. This file is the reference for every Romanian text in the trainer, the pocket guide and the website.*

**Scope.** This guide covers the Romanian text of an ECG training app: the one-line rhythm summary, the bullet findings, the take-away, the diagnostic criteria, the pitfalls and the interface text. Readers are doctors, residents, students and nurses.

**Decision rule.** Use ward and report wording when it is also correct in textbooks and in the Romanian translations of the ESC guidelines. Where the two differ, the textbook or guideline term goes in running text and the ward abbreviation goes in parentheses.

**How to read the counts.** "n/5" is the number of the five research reports that support a choice. The five reports cover universities, textbooks, ESC guidelines in Romanian, residents and clinical writing, and nursing and online sources. Bracketed numbers refer to the source list at the end.

## 1. Register and address

> **Changed 2026-11-03 by Alex: address the reader with „tu” (second person singular), not „dumneavoastră”.**
> Everywhere the text speaks to the reader (interface, prompts, take-aways, pitfalls, site, pocket guide): „Caută…”, „Verifică…”, „Ce faci mai întâi?”, „Progresul tău”. Impersonal clinical prose („Se observă…”, „Se anunță medicul”) stays impersonal. Where the rules below say „polite plural”, read „tu”. The research notes below are kept for the record.


- **Explanation text** (findings, criteria) is impersonal clinical prose:
  - „Se observă…”, „Se măsoară intervalul PR…”, „Traseul evidențiază…”, or plain noun phrases.
  - Teaching asides may use the first person plural, as Romanian university courses do: „Stabilim mai întâi ritmul, apoi frecvența…” [1–4].
- **Take-aways and pitfalls** may speak to the reader in the polite plural („Căutați…”, „Verificați…”), the same register as the interface. Keep one register within one text.
- **Prompts and buttons** use the polite plural imperative or a noun:
  - Imperative: „Alegeți diagnosticul”, „Verificați răspunsul”, „Afișați explicația”.
  - Noun: „Traseul următor”, „Răspuns corect”, „Răspuns incorect. Diagnosticul corect este: …”.
  - Never use the informal *tu* („Alege”, „Ai greșit”). It reads as marketing copy [36].
- **Clinical actions** are written impersonally: „Se anunță laboratorul de cateterism pentru angioplastie primară.” Do not write „Anunțați sala de cateterism” or „Activați cath lab-ul”.
- **Diagnosis labels** lead with the noun, in sentence case: „Bloc major de ramură stângă”, „Fibrilație atrială cu alură ventriculară rapidă”.
- **Hedging** uses „aspect sugestiv pentru”, „compatibil cu” or „pledează pentru”. Do not use „înseamnă” to go from an ECG finding to a diagnosis.
- **Contested:** no Romanian corpus of medical app UI text was found. The polite plural follows nursing guides [37] and official writing.

## 2. Units and numbers

| Item | Rule | Example |
|---|---|---|
| Decimal separator | Always a comma | 0,20 s; 2,5 mm; 0,1 mV |
| Intervals | Milliseconds, as in the ESC Romanian guidelines and residents' reports [14–22] | PR 220 ms, QRS 120 ms, QTc 460 ms |
| Seconds | Only when teaching the grid; give ms once in parentheses | 1 pătrat mic = 1 mm = 0,04 s (40 ms) |
| Rate | House style /min with no space. „bpm”, „b/min” and „bătăi/min” are also natural Romanian (ESC RO guidelines, residents), not errors | FC 75/min |
| Number and unit | Separated by a space | 2 mm, 10 mm/mV, 25 mm/s |
| ST deviation | mm on the tracing, mV in criteria, measured at the J point | supradenivelare ST de 2 mm; ≥ 0,1 mV (1 mm) |
| Axis | Degrees with a sign | ax QRS +60°; −30° |
| Axis position | In criteria and definitions: „ax normal (−30°…+90°)”. In summary lines: orizontalizat (−30°…+30°), intermediar (+30°…+60°), verticalizat (+60°…+90°). „Intermediar” is a band inside normal, never a synonym for normal | ax QRS verticalizat, +80° |
| Ranges | En dash, no spaces, unit written once | 60–100/min; 0,12–0,20 s; V1–V4 |
| Ratios | Colon | conducere AV 2:1 |
| Comparisons | Space after the operator | > 0,20 s; ≥ 120 ms |
| Approximation | „~” or „aprox.”, used once | FC medie ~54/min |
| Degree of block | Roman numerals | BAV gradul I / II / III |

Never write „0.20 s” or „0,12-0,20 de secunde”. Do not mix s and ms in one explanation, except for a single conversion.

## 3. How Romanians describe an ECG

**Order.** Universities, textbooks and residents all use the same sequence [1, 3, 8, 11, 14]:

ritm → frecvență → ax QRS → unda P și intervalul PR → complexul QRS (durată, morfologie, blocuri) → segmentul ST și unda T (repolarizare) → QT/QTc → alte elemente (extrasistole, undă delta, spike-uri) → „Concluzie:” or „Diagnostic ECG:”.

**Summary line.** Use noun phrases separated by commas, with no verbs:

„Ritm sinusal, FC 75/min, ax QRS intermediar (+45°), PR 160 ms, QRS îngust, fără modificări ST-T.”

**Real examples (quoted as published, so unit and diacritic use may differ from the rules above):**
- „RS, AV = 75/min, ax QRS intermediar, PR = 120 msec, fără modificări ST-T, fără undă delta” [14, nr. 23]
- „Traseul EKG de repaus evidențiază RS, AV 75 bpm, ax QRS orizontalizat, HVS cu modificari secundare ale fazei de repolarizare” [9]
- „Interpretare: Bradicardie sinusala. Supradenivelare marcata de segment ST in DII, DIII, aVF si V4R. Semne in oglinda… Diagnostic: Infarct acut de miocard… in faza supraacuta” [4]
- „Ritm sinusal cu bloc AV de gradul 1” [11]. Figure captions in [11] give the diagnosis first and the features in parentheses.

**Phrasing**

| Need | Use | Avoid |
|---|---|---|
| Narrative verbs | evidențiază, relevă, se observă, se constată; decelează (formal) | — |
| Patterns | „aspect de BRD major”, „aspect QS în V1–V3”, „aspect rSR' în V1” | — |
| Normal findings | „fără modificări ST-T”, „fără modificări de fază terminală”, „QTc în limite normale” | — |
| Joining findings | „cu”, „asociat cu” | „plus” |
| Leads | „în DII, DIII și aVF” (summary lines may drop „în”) | — |
| Territory | „în teritoriul inferior / anteroseptal / lateral”, always with the leads named, because schools draw the territories differently | a territory label with no leads |
| Infarct stage | faza supraacută / acută / subacută / cronică (sechelă); „în evoluție” | — |
| Infarct triad | ischemie (unda T), leziune subepicardică / subendocardică (ST), necroză (unda Q) | — |

**Model lines for the app**
- „Fiecare complex QRS este precedat de o undă P sinusală; ritm sinusal cu aritmie sinusală respiratorie, FC medie ~54/min.”
- „PR constant, alungit (~220 ms): BAV gradul I.”
- „Supradenivelare de segment ST de 2–3 mm în DII, DIII și aVF, cu subdenivelare ST în oglindă în aVL: STEMI inferior (diagnostic prezumtiv). Se anunță laboratorul de cateterism pentru angioplastie primară.”
- „Ritm ventricular electrostimulat, 70/min: fiecare complex QRS este precedat de un spike de stimulare (interval între spike-uri 850 ms); QRS larg, cu aspect de BRS.”
- „Fibrilație atrială cu ritm ventricular electrostimulat (VVI).”
- „Bloc major de ramură stângă (BRS major).”
- These are already natural and can stay: „Hemibloc anterior stâng”, „Bigeminism ventricular”, „Extrasistolă ventriculară”, „spike de stimulare”.

## 4. Abbreviations

**Policy**
- In teaching text, spell the term out on first mention with the abbreviation in parentheses, then use the abbreviation alone: „bloc atrioventricular (BAV) de gradul I”.
- Summary lines and labels for doctors may use the abbreviation directly.
- Nurse-facing screens spell terms out.
- Use Romanian abbreviations in prose. Keep only the English ones Romanian practice keeps: STEMI, NSTEMI, QTc, WPW, the pacing modes (VVI, DDD, AAI), and PCI inside guideline quotations.

**Standard set:** RS, FC, AV (alură ventriculară, used in report lines), BAV, BRD, BRS, HBAS, HVS, HVD, ESV, ESA, ESSV, TPSV, TSV, TRNAV, TRAV, TV, TVNS, FV, FiA, TAM, RIVA, SCA, IMA, STEMI, NSTEMI, NSTE-SCA, ARI, ACD, ADA, ACx, VS, VD, CA, QTc.

**Collisions**
- **AV** means both *alură ventriculară* and *atrioventricular*.
  - In prose, write „alură ventriculară” in full.
  - Keep AV for bloc AV, nod AV, conducere AV 2:1 and interval AV programat.
  - Use AV for rate only in a telegraphic report line.
- **HAS** means both *hemibloc anterior stâng* and *hipertrofie atrială stângă* in Romanian textbooks. Never write HAS: use HBAS for the hemiblock and spell out „hipertrofie atrială stângă”.
- **FA / FiA.** Both mean atrial fibrillation (FA in the ESC 2024 AF guideline and most textbooks, FiA in residents' reports). Spell out „fibrilație atrială” in the app; FiA is the house abbreviation where one is needed. Atrial flutter is FLA (ESC 2024 AF guideline).

**Never in Romanian prose:** LBBB, RBBB, LAFB, LPFB, PVC, PAC, VT, AF, RVR, LAD, RCA, LCx, AVNRT, AVRT, LVH, IVCD.

**Leads** (5/5 reports agree)
- Write DI, DII, DIII, aVR, aVL, aVF, V1–V6, V3R–V4R, V7–V9.
- D1/D2/D3 are acceptable. Avoid bare I/II/III, „derivația 2” and „Lead II”. The „a” in aVR/aVL/aVF stays lower case.
- Lead groups:

| Group | Leads |
|---|---|
| Inferioare | DII, DIII, aVF |
| Laterale | DI, aVL, V5, V6 |
| Lateral înalt | DI, aVL |
| Septale | V1–V2 |
| Anteroseptal | V1–V4 |
| Anterior extins | V1–V6 ± DI, aVL |
| Posterioare | V7–V9 |
| Drepte | V3R–V4R |

**Capitalisation and typography**
- **Case**
  - Diagnoses are lower case in running text.
  - Labels and line starts use sentence case, never Title Case.
  - Eponyms keep their capital: Mobitz, Luciani-Wenckebach, Sokolow-Lyon, Cornell, Bazett, Pardée, Wellens, Sgarbossa, Kent.
- **Diacritics**
  - Use ș and ț with the comma below (U+0219, U+021B), not the cedilla forms ş and ţ.
  - Use î at the start and end of a word and â inside it.
- **Punctuation**
  - Quotation marks are „…” (U+201E, U+201D); nested quotes are «…».
  - Use the en dash for ranges.
  - Use a hyphen before endings on loanwords whose spelling differs from their pronunciation: ECG-ul, spike-ul, spike-uri. But „pacemakerul”, with no hyphen.
- **Spellings**
  - ECG is preferred over EKG in doctor-facing text. Nursing material uses EKG about four times as often, so EKG is acceptable on nurse-facing pages. Write „traseul ECG”; „ECG-ul” is neuter.
  - One word: anteroseptal, anterolateral, inferolateral, preexcitație, pseudofuziune, pseudoinfarct.
  - Write „fierăstrău”, not „ferăstrău”.

## 5. Glossary

The last column gives n/5 (supporting reports) followed by the source numbers. C marks a contested entry; see section 7.

### 5.1 Tracing and paper
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| ECG tracing | traseu ECG | ECG | electrocardiogramă, EKG | bandă, printare | 5 · 1,10,14 |
| Baseline | linia izoelectrică | – | linia de bază (native, Gherasim) | – | 5 · 1,3,10 |
| Baseline wander | deplasări ale liniei izoelectrice | – | linie izoelectrică instabilă; oscilațiile liniei de bază | baseline wander | 3 · 10,39 |
| Calibration | etalonare 10 mm/mV | – | calibrare | – | 5 · 1,10,37 |
| Paper speed | viteza de derulare a hârtiei, 25 mm/s | – | viteza hârtiei | – | 5 · 1,10,37 |
| Small / large box | pătrat mic / pătrat mare | – | pătrățel; căsuță mică / mare (written in Craiova courses) | cutii | 5 · 1,3,10 |
| Rhythm strip | bandă de ritm (ECG); for the long lead under a 12-lead: DII lung | – | traseu de ritm; derivație de ritm | strip | 2 · 25,22 (C) |
| Calipers | compas (ECG) | – | – | calipere; „riglă ECG” (a different tool: the plastic ruler) | 1 · – (C) |
| Systematic reading | interpretare sistematică a ECG | – | analiză sistematizată | – | 5 · 3,11,13 |
| Artefact | artefact | – | – | – | 3 · 39 |

### 5.2 Waves, intervals, axis
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| Waves / complex | unda P, complexul QRS, unda T, unda U | – | – | – | 5 · 1,3,8,11 |
| Narrow QRS | QRS îngust | – | QRS fin, suplu | – | 3 · 11,14 |
| Wide QRS | QRS larg | – | QRS lărgit | – | 5 · 8,11,14 |
| PR interval | intervalul PR | PR | intervalul PQ (mention once for nurses) | – | 5 · 2,8,15,37 (C) |
| QT / QTc | intervalul QT; QT corectat, formula Bazett | QTc | – | – | 5 · 8,11,19 |
| ST segment / J point | segmentul ST; punctul J | ST | – | elevația punctului J | 5 · 8,15,16 |
| Transition zone | zona de tranziție | – | – | – | 4 · 3,10,11 |
| Poor R progression | progresie lentă a undei R | – | – | progresie slabă | 4 · 10,14 |
| R-wave loss | amputarea undei R („R amputat”): a sudden drop in R amplitude between leads, a necrosis equivalent. Not a synonym for poor progression | – | – | – | 3 · 10,11,14 |
| Low voltage | microvoltaj; complexe QRS microvoltate | – | voltaj redus | low voltage | 3 · 8,11 |
| QRS axis | ax QRS | – | axul electric | axa cardiacă | 5 · 1,3,11 |
| Normal axis | ax QRS normal (−30°…+90°) | – | – | axa cardiacă normală; „intermediar” as a synonym for normal | 4 · 2,8 |
| Axis position (report lines) | ax orizontalizat (−30°…+30°) / intermediar (+30°…+60°) / verticalizat (+60°…+90°) | – | cord orizontalizat / verticalizat | – | 4 · 2,9,10,13,14 |
| Left / right axis deviation | deviație axială stângă / dreaptă | – | ax deviat la stânga / dreapta | deviație de ax stâng | 5 · 3,8,11 |

### 5.3 Rate and rhythm
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| Heart rate | frecvența cardiacă | FC | alură ventriculară (AV) in report lines | rată cardiacă, FCC | 5 · 8,14,15,35 (C) |
| Sinus rhythm | ritm sinusal | RS | – | – | 5 · 8,11,14 |
| Regular / irregular | ritm regulat / neregulat | – | – | ritm iregular | 5 · 8,11,40 |
| Sinus brady / tachy | bradicardie / tahicardie sinusală | – | – | – | 5 · 8,11,40 |
| Sinus arrhythmia | aritmie sinusală respiratorie | – | – | – | 4 · 8,11 |
| Junctional rhythm | ritm joncțional | – | ritm nodal (dated) | – | 5 · 8,11,40 |
| Escape rhythm | ritm de scăpare | – | ritm de înlocuire (older) | ritm de evadare | 5 · 8,11,40 |
| AIVR | ritm idioventricular accelerat | RIVA | – | AIVR | 2 · 8,15 |
| MAT | tahicardie atrială multifocală | TAM | tahicardie atrială haotică | – | 5 · 8,18 |

### 5.4 Supraventricular arrhythmias
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| Atrial fibrillation | fibrilație atrială | FiA | FA; FbA [11] | fibrilație auriculară, AF | 5 · 14,17,22,23 (C) |
| AF with RVR | FiA cu alură ventriculară rapidă / medie / lentă | – | AV înaltă / joasă (ward) | răspuns ventricular rapid, RVR | 5 · 14,22 |
| f / F waves | unde f (fibrilație) / unde F (flutter) | – | – | valuri f | 5 · 8,11,40 |
| Atrial flutter | flutter atrial (FLA) cu conducere AV 2:1 | FLA | transmitere 2:1, blocaj 2:1 | – | 5 · 8,11,18,22 |
| Sawtooth | unde F „în dinți de fierăstrău” | – | – | model de dinte de ferăstrău | 5 · 8,11 |
| PSVT | tahicardie paroxistică supraventriculară | TPSV | TSV (umbrella term) | PSVT | 5 · 8,18 |
| AVNRT | tahicardie prin reintrare în nodul atrioventricular | TRNAV | – | AVNRT | 4 · 18,14 |
| AVRT | tahicardie prin reintrare atrioventriculară | TRAV | – | AVRT | 4 · 18 |
| Atrial ectopic | extrasistolă atrială / supraventriculară | ESA / ESSV | – | contracție atrială prematură, PAC | 5 · 8,11,40 |

### 5.5 Ventricular ectopy and arrhythmias
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| PVC | extrasistolă ventriculară | ESV | ExV | contracție prematură, CVP, PVC | 5 · 8,11,14,40 |
| Bigeminy | bigeminism ventricular | – | ESV bigeminate / sistematizate | bigeminie | 5 · 8,11,40 |
| Pattern | ESV izolate / în cuplete / în salve; monomorfe / polimorfe; interpolate | – | – | – | 3 · 8,11 |
| Compensatory pause | pauză compensatorie (completă) | – | – | pauză compensatoare | 5 · 2,8,40 |
| Non-compensatory pause | pauză decalantă (compensatorie incompletă) | – | pauză compensatorie incompletă [11] | pauză necompensatorie (translated Harrison only) | 3 · 6,8,11 |
| Coupling interval | interval de cuplaj | – | – | interval de cuplare | 5 · 8,11 |
| R-on-T | fenomen R/T | – | R pe T | – | 2 · 8,11 |
| VT | tahicardie ventriculară susținută / nesusținută, monomorfă / polimorfă | TV / TVNS | – | VT | 5 · 8,19 |
| Torsades | torsada vârfurilor | – | torsade de pointes | – | 5 · 8,19 |
| Wide-complex tachycardia | tahicardie cu complexe QRS largi | – | – | WCT | 5 · 8,19 |
| AV dissociation | disociație atrioventriculară | – | disociație AV | – | 5 · 8,19 |
| Capture / fusion beats | capturi ventriculare; bătăi de fuziune | – | complexe de fuziune | – | 5 · 8,19 |
| VF | fibrilație ventriculară | FV | – | VF | 5 · 8,19 |

### 5.6 AV block
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| AV block | bloc atrioventricular | BAV | bloc AV | bloc cardiac | 5 · 8,11,17 |
| First degree | BAV gradul I | – | bloc AV de gradul I | – | 5 · 8,11,14 |
| Mobitz I | BAV gradul II tip Mobitz I (cu perioade Luciani-Wenckebach) | – | Wenckebach | – | 5 · 8,11,17 |
| Mobitz II / dropped P | BAV gradul II tip Mobitz II; undă P blocată | – | P neurmată de QRS | – | 5 · 8,11,17 |
| 2:1 / high grade | BAV gradul II cu conducere 2:1; BAV de grad înalt | – | BAV avansat | – | 5 · 8,17 |
| Complete | BAV gradul III (complet) | – | BAV complet (the most frequent form); BAV total | bloc cardiac complet | 5 · 8,11,17 |
| Grouped beating | complexe QRS grupate („bătăi grupate”), sugestive pentru perioade Luciani-Wenckebach. Describe the grouping first, then the likely cause | – | – | naming the mechanism as the pattern | 1 · – (C) |

### 5.7 Intraventricular conduction
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| LBBB | bloc major de ramură stângă (also the guideline term: ESC ACS 2023 RO, pacing 2021 RO) | BRS major | bloc de ram stâng (ESC pacing 2021 RO, residents); bloc complet de ramură stângă (rare) | LBBB | 5 · 8,14,15,17,38 |
| RBBB | bloc major de ramură dreaptă | BRD major | BRD complet | RBBB | 5 · 8,14,38 |
| Incomplete RBBB | bloc minor de ramură dreaptă | BRD minor | BRD incomplet | – | 5 · 8,38 |
| rSR' | aspect rSR' în V1 („în M”) | – | – | urechi de iepure | 5 · 8,11 |
| Secondary ST-T | modificări secundare de fază terminală, în opoziție de fază cu QRS | – | – | discordanță ST-T | 4 · 8,11,38 |
| LAFB | hemibloc anterior stâng | HBAS | hemibloc antero-superior, BFSA | HAS, LAFB | 5 · 8,11,38 (C) |
| LPFB | hemibloc posterior stâng (spelled out) | – | HPS, BFSP | LPFB | 5 · 8,38 (C) |
| Bi- / trifascicular | bloc bifascicular (BRD + HBAS) / trifascicular | – | – | – | 3 · 8,17 |
| IVCD | tulburare de conducere intraventriculară nespecifică | – | – | întârziere de conducere intraventriculară, IVCD | 5 · 38,17 |

### 5.8 Ischaemia, infarction, pericarditis
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| ST elevation | supradenivelare de segment ST | – | supradenivelare ST | elevație / elevare ST | 5 · 8,15,16,31 |
| ST depression | subdenivelare de segment ST orizontală / descendentă / ascendentă | – | – | depresie ST | 5 · 8,15,16 |
| Reciprocal change | subdenivelare ST în oglindă | – | subdenivelare reciprocă (criteria) | schimbări reciproce | 5 · 4,9,16,31 (C) |
| Contiguous leads | derivații adiacente | – | derivații contigue [16]; „derivații concordante” is native too (Ivan, UDMI RO, SRC) but the app avoids it because „concordant” means something else in Sgarbossa | – | 4 · 8,15,16 |
| STEMI | infarct miocardic acut cu supradenivelare de segment ST | STEMI | IMA cu supradenivelare ST | IMA-ST | 5 · 15,16,26 |
| NSTEMI / NSTE-ACS | infarct miocardic fără supradenivelare ST; SCA fără supradenivelare de segment ST | NSTEMI / NSTE-SCA | – | – | 5 · 15,16 |
| ACS | sindrom coronarian acut | SCA | – | – | 5 · 15 |
| Territory | STEMI inferior / anteroseptal / anterior extins / lateral / lateral înalt / anterolateral, always followed by the leads | – | „în teritoriul…”; anterior întins | – | 5 · 8,9,15,31 |
| Posterior MI | infarct posterior (V7–V9) | – | inferobazal [16] | – | 5 · 15,16 |
| RV infarct | infarct de ventricul drept (V3R, V4R) | VD | – | – | 5 · 4,15 |
| Culprit artery | artera responsabilă de infarct | ARI | „artera culprit” (ward jargon) | artera vinovată | 4 · 15,27 |
| Coronaries | artera coronară dreaptă, artera descendentă anterioară, artera circumflexă, trunchiul comun | ACD, ADA, ACx | IVA (older); ACX [4] | RCA, LAD, LCx | 5 · 8,15,27 |
| Hyperacute T | unde T hiperacute (înalte, ascuțite, simetrice) | – | – | – | 5 · 8,31 |
| T inversion | unde T negative | – | negativarea / inversarea undei T | inversia / inversiunea undei T | 5 · 8,14,31 |
| Flat / biphasic T | unde T aplatizate / bifazice | – | – | – | 5 · 8,11 |
| Q waves | unde Q patologice (de necroză); aspect QS | – | – | – | 5 · 8,11,16 |
| Tombstoning | marea undă monofazică (Pardée) | – | supradenivelare ST convexă | piatră funerară | 4 · 8,11 (C) |
| Evolving / old MI | infarct în evoluție; IM vechi (sechelă) | IM | – | – | 5 · 8,14 |
| Wellens | semnul Wellens (sindrom Wellens) | – | – | – | 4 · 13,31 |
| Sgarbossa | criteriile Sgarbossa (modificate Smith) | – | – | – | 4 · 11,15 |
| Cath lab | se anunță laboratorul de cateterism | – | sala de cateterism; alertarea echipei de cateterism | activarea cath lab-ului | 5 · 15,26,27 (C) |
| Primary PCI | angioplastie primară | – | PCI primară | – | 5 · 15,25 (C) |
| Presumed STEMI | diagnostic prezumtiv de STEMI | – | presupus STEMI | până la proba contrarie (unattested) | 3 · 15,26 (C) |
| Pericarditis | supradenivelare ST difuză, concavă în sus, fără subdenivelare ST în oglindă (cu excepția aVR și V1); subdenivelare PR | – | „ține apa” (Iași, informal) | depresie PR; „în șa” (that is the Brugada type 2 descriptor) | 5 · 8,12,13,24 |
| Early repolarisation | repolarizare precoce | – | – | repolarizare timpurie | 5 · 8,19 |
| Triad | ischemie (T) / leziune subepicardică, subendocardică (ST) / necroză (Q) | – | – | – | 5 · 6,8,31 |

### 5.9 Hypertrophy and chambers
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| LVH | hipertrofie ventriculară stângă | HVS | – | LVH | 5 · 8,9,23 |
| Voltage criteria | indicele Sokolow-Lyon; indicele Cornell | – | criteriul Cornell | Sokolov | 5 · 11,14,23 |
| Strain | HVS cu modificări secundare de fază terminală (ST-T) | – | tulburări secundare de repolarizare; aspect de suprasolicitare | pattern de strain, strain VS | 5 · 9,14,23 (C) |
| RVH | hipertrofie ventriculară dreaptă | HVD | – | RVH | 5 · 8,11 |
| LA enlargement | hipertrofie atrială stângă (P mitral) | – | dilatare / suprasolicitare atrială stângă | HAS | 4 · 8,10,11,14 |
| RA enlargement | hipertrofie atrială dreaptă (P pulmonar) | – | suprasolicitare atrială dreaptă | – | 3 · 8,10,11 |

### 5.10 Pre-excitation
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| WPW pattern | preexcitație ventriculară (aspect WPW) | WPW | pattern WPW [18] | – | 5 · 8,11,18 |
| WPW syndrome | sindrom Wolff-Parkinson-White | WPW | – | – | 5 · 8,18 |
| Delta wave / short PR | undă delta; interval PR scurt | – | – | – | 5 · 8,11,14 |
| Accessory pathway | cale accesorie | CA | fascicul accesor (Kent) | – | 5 · 18 |
| Pseudoinfarct | aspect de pseudoinfarct | – | „poate mima un infarct” | – | 4 · 8,11 |

### 5.11 Pacing
| Concept | Romanian to use | Abbr. | Also acceptable | Avoid | Sources |
|---|---|---|---|---|---|
| Pacemaker (device) | stimulator cardiac | – | pacemaker, cardiostimulator | – | 5 · 7,17,28 |
| Pacing (act) | stimulare cardiacă | – | cardiostimulare | „pacing” in prose | 3 · 17,30 |
| Patient with pacemaker | pacient purtător de stimulator cardiac | – | – | – | 3 · 7,29 |
| Spike | spike de stimulare | – | artefact de stimulare | – | 5 · 7,28,29 |
| Paced rhythm | ritm ventricular electrostimulat | – | ritm ventricular stimulat | „stimulare la 70/min” as a label | 5 · 7,17,28 |
| Capture | captură; pierderea capturii; prag de stimulare | – | – | eșec de captură | 5 · 7,17,29 |
| Sensing | detecție; subdetecție; supradetecție | – | sensing, undersensing, oversensing | – | 5 · 7,17,29 |
| Fusion | bătăi de fuziune / pseudofuziune | – | – | – | 4 · 7,28 |
| Modes | mod VVI / DDD / AAI; stimulare unicamerală / bicamerală | – | monocamerală | – | 5 · 17,28 |
| Lower rate | frecvența minimă de stimulare (programată) | – | frecvența de bază (ESC pacing 2021 RO) | rata inferioară | 5 · 17,28 |
| AV delay | interval AV programat | – | – | întârziere AV | 5 · 17,28 |
| Demand pacing | stimulare „la cerere”, inhibată de activitatea spontană | – | – | pe cerere | 5 · 28,30 |
| Paced QRS | QRS larg, cu aspect de BRS | – | – | morfologie tip LBBB | 5 · 7,28 |
| Device follow-up | sindrom de pacemaker; procent de stimulare; interogarea stimulatorului | – | – | – | 1 · 17 |

## 6. Translated-sounding phrases and replacements

| Avoid | Use |
|---|---|
| rată cardiacă | frecvență cardiacă / alură ventriculară |
| ritm iregular | ritm neregulat |
| elevație / elevare ST | supradenivelare ST |
| depresie ST / PR | subdenivelare ST / PR |
| contracție prematură, CVP, PVC | extrasistolă ventriculară (ESV) |
| răspuns ventricular rapid | alură ventriculară rapidă |
| bloc cardiac complet | BAV gradul III (complet) |
| ritm de evadare | ritm de scăpare |
| repolarizare timpurie | repolarizare precoce |
| progresie slabă a undei R | progresie lentă a undei R |
| pattern de strain | modificări secundare de fază terminală |
| inversia undei T | unde T negative |
| derivația II, Lead II, bare „II” | DII |
| artera vinovată | artera responsabilă de infarct |
| activarea cath lab-ului; „Anunțați…” | „Se anunță laboratorul de cateterism” |
| eșec de captură | pierderea capturii |
| întârziere AV | interval AV programat |
| rata inferioară | frecvența minimă de stimulare |
| pe cerere | „la cerere” |
| morfologie tip LBBB | aspect de BRS |
| piatră funerară | marea undă monofazică (Pardée) |
| valuri f | unde f |
| model de dinte de ferăstrău | „în dinți de fierăstrău” |
| cutii | pătrate mici / mari |
| calipere | compas ECG |
| urechi de iepure | aspect rSR' („în M”) |
| interval de cuplare | interval de cuplaj |
| bigeminie | bigeminism |
| deviație de ax stâng | deviație axială stângă |
| axa cardiacă normală | ax QRS normal |
| pauză necompensatorie | pauză decalantă |
| concavă „în șa” (pericarditis) | concavă în sus |
| riglă ECG (for calipers) | compas |
| X „plus” Y | X cu / asociat cu Y |
| „înseamnă” | aspect sugestiv pentru / compatibil cu |
| „la fiecare bătaie” | constant |
| repeated „aproximativ” | „~” once |
| 0,12-0,20 de secunde | 0,12–0,20 s |

**House-style choices, not errors.** These are native Romanian, but the app uses one form for consistency: „linia de bază” (app: linia izoelectrică), „derivații concordante” (app: adiacente, because of the Sgarbossa meaning), „bloc de ram stâng” and „BRS complet” (app: bloc major de ramură stângă), „bpm” (app: /min), FA (app: fibrilație atrială spelled out, FiA when abbreviated).

**Archaic or regional forms to avoid**
- Archaic: fibrilație auriculară, pauză compensatoare, turburări.
- Moldovan register [35]: FCC, IMA-ST, inversia undei T.

**Sources to read with care**
- The Craiova modules 3–4 and the module on acute myocardial infarction [5] are partly translated from English.
- The Romanian ESC 2022 guideline on ventricular arrhythmias [19] contains calques („elevația punctului J”, CVP).
- The Pocket ECG translation [34] is in translated register.

## 7. Contested choices and open questions

1. **FC vs AV for rate.** Teaching prose uses FC. Residents' reports use AV (alură ventriculară) about four times more often (~75 vs ~18) [14]. Decision: FC in the app; AV mentioned in the explanation of how reports are written.
2. **FiA vs FA.**
   - FiA is used by residents (54 vs 8 and 373 vs 15 in two corpora), the SRC pacing and hypertension guidelines, and UMFT.
   - FA is used by the universities and the ESC 2024 AF guideline.
   - Mitu [11] uses FbA.
   - Decision: FiA, with FA accepted.
3. **ms vs s.** Guidelines and residents use ms. Textbooks and nursing material use s. Decision: ms in the app, s only when teaching the grid.
4. **Interface form of address.** No Romanian medical app was available as a source. The polite plural is an inference.
5. **Laborator vs sala de cateterism**, and the local alert wording. Both are attested. Hospitals word the alert differently.
6. **„Până la proba contrarie”.** It is idiomatic Romanian but not attested in medical sources. Use „diagnostic prezumtiv” for STEMI. Exception: „TV până la proba contrarie” for a wide-QRS tachycardia is the standard Romanian teaching phrase and stays (pocket guide card 8).
7. **Terms with thin Romanian evidence:**
   - calipers („compas” is natural but unattested in print)
   - grouped beating
   - tombstone (the „marea undă monofazică” label covers the wider pattern)
8. **Bundle branch block naming: resolved.** The Romanian guidelines also say „major” (ESC ACS 2023, pacing 2021, SVT 2019, SRC 2018 compendium). „Complet” is a rare variant.
9. **Fascicular block abbreviations.**
   - HBAS vs BFSA for the anterior hemiblock.
   - There is no agreed abbreviation for the posterior hemiblock: HPS, HBPI, HBSP and BFSP are all used.
10. **Left atrial enlargement: resolved** in favour of „hipertrofie atrială stângă” (ECG chapters 38 vs 25; „dilatare” is mostly echo language).
11. **„În oglindă” vs „reciprocă”.** Clinical prose prefers „în oglindă” (31 hits). UDMI [16] uses „reciprocă”.
12. **„Adiacente” vs „contigue” vs „concordante”.** All three are native. The app uses „adiacente” (ESC ACS 2023 RO) because „concordante” clashes with the Sgarbossa meaning of „concordant”.
13. **Gender of PCI.** ESC uses „PCI primară”; residents write „PCI primar”.
14. **Coverage gaps.** Several textbooks could not be accessed: Ginghină, Dubin (Romanian edition), Dudea, the Iași resident lectures and the UMFCD workbooks. No real discharge letters were found; the residents' journal stands in for them.

## 8. House decisions for this app (quick list)

1. Leads: DI, DII, DIII, aVR, aVL, aVF, V1–V6. Never bare I, II, III.
2. Rate: „frecvență” / FC in prose, „/min” as the unit. Irregular rhythms: „alură ventriculară medie ~X/min”.
3. Axis: „ax normal” in criteria; orizontalizat / intermediar / verticalizat with the degrees in case findings; „deviație axială stângă / dreaptă”.
4. Intervals in ms with comma decimals; seconds only when teaching the grid.
5. ST: „supradenivelare / subdenivelare de segment ST”, „în oglindă” for reciprocal change, „derivații adiacente”.
6. Bundle branch block: „bloc major / minor de ramură dreaptă / stângă” (BRD, BRS); „hemibloc anterior stâng” (HBAS).
7. AV block: „BAV gradul I / II / III”, „tip Mobitz I (perioade Luciani-Wenckebach)”, „tip Mobitz II”, „BAV complet”.
8. Atria: „hipertrofie atrială stângă / dreaptă” (P mitral / P pulmonar). Never HAS.
9. Ectopy: „extrasistolă ventriculară / atrială” (ESV / ESA), „bigeminism”, „pauză compensatorie” / „pauză decalantă”.
10. Pacing: „stimulator cardiac” (pacemaker is acceptable), „spike de stimulare”, „ritm electrostimulat”, „captură / pierderea capturii”, „detecție / subdetecție / supradetecție”, „frecvența minimă de stimulare”, „interval AV programat”, „la cerere”.
11. Ischaemia actions: „se anunță laboratorul de cateterism”, „angioplastie primară”, „diagnostic prezumtiv de STEMI”, „artera responsabilă de infarct”.
12. Territory labels always carry their leads.
13. Diacritics ș, ț with the comma below; quotes „…”; en dash for ranges; ECG-ul with a hyphen.
14. Interface: polite plural („Alegeți”, „Verificați”), sentence case, never „tu”.

## Sources
1. UMF Craiova, EKG1 — https://www.umfcv.ro/files/e/k/EKG1.pdf
2. UMF Craiova, LP2 Semiologie medicală an III — suportcursonline.umfcv.ro
3. UMF Craiova, an IV curs 1 (ECG normală) — suportcursonline.umfcv.ro
4. UMF Craiova, Explorări funcționale, ECG Modul 2 — suportcursonline.umfcv.ro
5. UMF Craiova, Modul 4_IMA (contains calques) — suportcursonline.umfcv.ro
6. UMF Craiova, Fiziopatologie curs 20 — suportcursonline.umfcv.ro
7. UMF Craiova, Dispozitive intracardiace (curs 6) — suportcursonline.umfcv.ro
8. UMF Timișoara, Curs de cardiologie (Ivan, 2022) — https://www.umft.ro/wp-content/uploads/2022/02/Carte-curs-cardiologie.pdf
9. UMF Timișoara, grile licență 2023 — https://www.umft.ro/wp-content/uploads/2023/04/Variante-grile-licenta-MEDICINA_2023.pdf
10. Alecu, Inițiere în electrocardiografie (OAMMR Mureș) — cursuri.oammr-mures.ro
11. Mitu (coord.), Ghid de electrocardiografie practică, UMF Iași, 2012
12. Gherasim, Medicină internă, vol. II
13. Cercul ECG UMF Iași — https://cercekg.ro/cursuri-ecg/
14. Revista Rezidentului (SRC), nr. 7–25 — https://www.cardioportal.ro/revista-rezidentului/
15. Ghidul ESC 2023 SCA (RO) — ms.ro
16. Definiția universală a infarctului miocardic, 2018 (RO) — ms.ro
17. Ghidul ESC 2021 stimulare cardiacă (RO) — ms.ro
18. Ghidul ESC 2019 TSV (RO) — ms.ro
19. Ghidul ESC 2022 aritmii ventriculare (RO) — ms.ro
20. Ghidul ESC 2018 sincopă (RO) — ms.ro
21. Ghidul ESC 2023 cardiomiopatii (RO) — ms.ro
22. SRC, Ghidul ESC 2024 FA — cardioportal.ro
23. SRC, Ghidul ESC 2024 HTA — cardioportal.ro
24. SRC, Ghidul ESC 2025 miocardită/pericardită — cardioportal.ro
25. SRC, Compendiu ghiduri ESC 2018 — cardioportal.ro
26. Ghidul român pre-spital STEMI 2009 — atitimisoara.ro
27. UMFCD, rezumat teză Zamfir (STEMI) — umfcd.ro
28. Mitre (UMF Cluj), Electrostimularea cardiacă — atimures.ro
29. ROmedic, Complicațiile pacemakerelor — proceduri.romedic.ro
30. CNRR, Monitorizare/Cardiostimulare — cardioportal.ro
31. Benteu, Curs ECG ischemie și infarct — cardiologiedeva.ro
32. Viața Medicală, „Anxietățile din stagiul de cardio” — viata-medicala.ro
33. CNAS, Scrisoare medicală 2024 — cnas.ro
34. Pocket ECG (translated register; counter-example) — all.ro
35. PCN-81 Moldova (variant register) — ambulanta.md
36. MEDSkill blog — medskill.ro
37. Pagina de Nursing, ECG în 12 derivații — paginadenursing.ro
38. ROmedic, Tulburări de conducere intraventriculare — romedic.ro
39. Practica Medicală 2011, artefacte ECG — rjmp.com.ro
40. UMF Craiova, Semiologie curs 2, tulburări de ritm și conducere — suportcursonline.umfcv.ro
