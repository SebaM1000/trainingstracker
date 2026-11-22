// Wissenschaftliche Grundlagen. Neue Quellen einfach ergänzen.
export const REFS = {
  pelland2024: {
    cite: 'Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC (2026). The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. Sports Medicine 56(2), 481–505.',
    use: 'Wochenvolumen mit abnehmendem Grenznutzen; Zählung von Sätzen „fraktional“ (direkt = 1, indirekt = 0,5). Frequenz wirkt vor allem auf Kraft.',
  },
  remmert2025: {
    cite: 'Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC (2025). Is there too much of a good thing? Meta-regressions of the effect of per-session volume on hypertrophy and strength. SportRxiv (Preprint).',
    use: 'Hinweis auf sehr hohes Volumen pro Einheit: Volumen besser auf mehrere Tage verteilen.',
  },
  schoenfeld2017vol: {
    cite: 'Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. Journal of Sports Sciences 35(11), 1073–1082.',
    use: 'Startwert ≥ 10 Sätze pro Muskel und Woche für Hypertrophie.',
  },
  schoenfeld2017load: {
    cite: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW (2017). Strength and hypertrophy adaptations between low- vs. high-load resistance training. Journal of Strength and Conditioning Research 31(12), 3508–3523.',
    use: 'Hypertrophie über weite Lastbereiche ähnlich, Maximalkraft profitiert von hohen Lasten.',
  },
  refalo2023: {
    cite: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ (2023). Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy. Sports Medicine 53(3), 649–665.',
    use: 'Sätze nahe am Versagen sind für Hypertrophie wirksam; echtes Versagen ist nicht zwingend.',
  },
  robinson2024: {
    cite: 'Robinson ZP, Pelland JC, Remmert JF et al. (2024). Exploring the dose–response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy. Sports Medicine 54, 2209–2231.',
    use: 'Hypertrophie steigt, je näher am Versagen; Kraftzuwachs kaum abhängig von der RIR. Grundlage der RIR-Zielbereiche.',
  },
  helms2016: {
    cite: 'Helms ER, Cronin J, Storey A, Zourdos MC (2016). Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength and Conditioning Journal 38(4), 42–49.',
    use: 'RIR-Skala zur Steuerung der Satzintensität; Lastvorschläge nach RIR.',
  },
  epley1985: {
    cite: 'Epley B (1985). Poundage chart. Boyd Epley Workout. Lincoln, NE. Erweiterung um RIR: e1RM = Last × (1 + (Wdh + RIR)/30).',
    use: 'Geschätztes 1RM (e1RM) zur Fortschrittsanzeige über verschiedene Wiederholungszahlen hinweg.',
  },
  seiler2010: {
    cite: 'Seiler S (2010). What is best practice for training intensity and duration distribution in endurance athletes? International Journal of Sports Physiology and Performance 5(3), 276–291.',
    use: 'Intensitätsverteilung: ca. 80 % locker (unterhalb der 1. Schwelle), ca. 20 % intensiv.',
  },
  stoggl2014: {
    cite: 'Stöggl T, Sperlich B (2014). Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training. Frontiers in Physiology 5, 33.',
    use: 'Polarisierte Verteilung als Zielwert für ambitionierte Ausdauersportler.',
  },
  ronnestad2014: {
    cite: 'Rønnestad BR, Mujika I (2014). Optimizing strength training for running and cycling endurance performance: a review. Scandinavian Journal of Medicine & Science in Sports 24(4), 603–612.',
    use: 'Krafttraining verbessert Ökonomie und Leistung von Läufern und Radfahrern.',
  },
  schumann2022: {
    cite: 'Schumann M, Feuerbacher JF, Sünkeler M et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function. Sports Medicine 52(3), 601–612.',
    use: 'Paralleltraining beeinträchtigt Hypertrophie und Maximalkraft kaum, Explosivkraft eher; Trennung der Einheiten hilft.',
  },
  foster2001: {
    cite: 'Foster C, Florhaug JA, Franklin J et al. (2001). A new approach to monitoring exercise training. Journal of Strength and Conditioning Research 15(1), 109–115.',
    use: 'Session-RPE-Belastung = RPE (CR-10) × Dauer in Minuten. Für Kraft, Ausdauer und Kampfsport einheitlich.',
  },
  foster1998: {
    cite: 'Foster C (1998). Monitoring training in athletes with reference to overtraining syndrome. Medicine & Science in Sports & Exercise 30(7), 1164–1168.',
    use: 'Monotonie (Mittelwert/Standardabweichung der Tageslast) und Strain (Wochenlast × Monotonie).',
  },
  williams2017: {
    cite: 'Williams S, West S, Cross MJ, Stokes KA (2017). Better way to determine the acute:chronic workload ratio? British Journal of Sports Medicine 51(3), 209–210.',
    use: 'Akute (7 Tage) und chronische (28 Tage) Belastung als exponentiell gewichtete Mittelwerte.',
  },
  impellizzeri2020: {
    cite: 'Impellizzeri FM, Tenan MS, Kempton T et al. (2020). Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. International Journal of Sports Physiology and Performance 15(6), 907–913.',
    use: 'Kritik am ACWR: daher nur als Orientierung für sprunghafte Belastungsanstiege, nicht als Verletzungsprognose.',
  },
  edwards1993: {
    cite: 'Edwards S (1993). The Heart Rate Monitor Book. Sacramento: Fleet Feet Press.',
    use: 'Zonen-TRIMP: Minuten in Zone 1–5 × Faktor 1–5.',
  },
  tanaka2001: {
    cite: 'Tanaka H, Monahan KD, Seals DR (2001). Age-predicted maximal heart rate revisited. Journal of the American College of Cardiology 37(1), 153–156.',
    use: 'Schätzung HFmax = 208 − 0,7 × Alter, falls kein gemessener Wert vorliegt.',
  },
  karvonen1957: {
    cite: 'Karvonen MJ, Kentala E, Mustala O (1957). The effects of training on heart rate. Annales Medicinae Experimentalis et Biologiae Fenniae 35, 307–315.',
    use: 'Herzfrequenzzonen über die Herzfrequenzreserve, wenn Ruhepuls bekannt ist.',
  },
  coggan2010: {
    cite: 'Allen H, Coggan A (2010). Training and Racing with a Power Meter (2. Aufl.). Boulder: VeloPress.',
    use: 'Leistungszonen in % der FTP für Rad und Ergometer.',
  },
  manresa2021: {
    cite: 'Manresa-Rocamora A et al. (2021). Heart rate variability-guided training for enhancing cardiac-vagal modulation, aerobic fitness, and endurance performance: a methodological systematic review with meta-analysis. International Journal of Environmental Research and Public Health 18(19), 10299.',
    use: 'HRV-gesteuertes Training verbessert die HRV; bei Ausdauerleistung kleine, nicht signifikante Vorteile gegenüber festem Plan.',
  },
  dueking2021: {
    cite: 'Düking P, Zinner C, Reed JL, Holmberg HC, Sperlich B. Predefined vs data-guided training prescription based on autonomic nervous system variation: a systematic review. Scandinavian Journal of Medicine & Science in Sports, doi:10.1111/sms.13802.',
    use: 'Datengesteuerte Pläne erreichen ähnliche Anpassungen mit weniger intensiven Einheiten.',
  },
  saw2016: {
    cite: 'Saw AE, Main LC, Gastin PB (2016). Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures. British Journal of Sports Medicine 50(5), 281–291.',
    use: 'Eigene Einschätzung (Befinden, Müdigkeit) reagiert empfindlich auf Belastung; deshalb lässt sich die Tagesform manuell überschreiben.',
  },
  who2020: {
    cite: 'Bull FC, Al-Ansari SS, Biddle S et al. (2020). World Health Organization 2020 guidelines on physical activity and sedentary behaviour. British Journal of Sports Medicine 54(24), 1451–1462.',
    use: 'Mindestumfang für das Ziel Gesundheit.',
  },
};
