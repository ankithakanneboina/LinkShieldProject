import PDFDocument from 'pdfkit';
import { DISCLAIMER } from '../constants.js';

const COLORS = {
  navy: '#0b1530',
  cyan: '#22d3ee',
  text: '#1b2440',
  muted: '#5b6685',
  line: '#d7dcea',
  low: '#0b7a0b',
  medium: '#9a6a00',
  high: '#b32d2d',
};
const RISK_LABEL = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };
const SEVERITY_LABEL = { high: 'Strong signal', medium: 'Moderate signal', low: 'Weak signal' };

/**
 * The built-in PDF fonts only cover Latin-1. Any other character is printed as its code point, e.g. [U+0430],
 * which also makes look-alike (homograph) characters in a URL visible in the report.
 */
export function pdfSafe(text) {
  return Array.from(String(text ?? ''))
    .map((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= 32 && cp <= 126 ? ch : cp >= 160 && cp <= 255 ? ch : `[U+${cp.toString(16).toUpperCase().padStart(4, '0')}]`;
    })
    .join('');
}

/** Unbroken URLs do not wrap in PDFs, so insert line breaks every `n` characters. */
export const breakLong = (text, n = 78) => (pdfSafe(text).match(new RegExp(`.{1,${n}}`, 'g')) || ['']).join('\n');

const fmtUtc = (d) => `${new Date(d).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
const pct = (v) => `${(v * 100).toFixed(1)}%`;

/** Renders the stored scan record (never request input) into a PDF and resolves with the bytes. */
export function buildScanReport(scan, { generatedAt = new Date() } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `LinkShield scan report ${scan.id}`, Author: 'LinkShield', Subject: 'URL phishing risk report' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const ensureSpace = (needed) => {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 30) doc.addPage();
    };
    const heading = (text) => {
      ensureSpace(60);
      doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor(COLORS.navy).text(text, left, doc.y);
      doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(COLORS.line).lineWidth(1).stroke();
      doc.moveDown(0.6);
    };

    // ---- branded header ------------------------------------------------------------------------
    doc.rect(0, 0, doc.page.width, 92).fill(COLORS.navy);
    doc.rect(0, 92, doc.page.width, 4).fill(COLORS.cyan);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26).text('LinkShield', left, 28);
    doc.font('Helvetica').fontSize(11).fillColor('#a9b6dd').text('AI-Powered Phishing URL Detection and Risk Analysis', left, 60);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(18).text('URL Scan Report', left, 116);

    // ---- verdict ---------------------------------------------------------------------------------
    const phishing = scan.prediction === 'phishing';
    const riskColor = COLORS[scan.riskCategory] || COLORS.text;
    doc.moveDown(0.6);
    const boxTop = doc.y;
    doc.roundedRect(left, boxTop, width, 62, 6).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica-Bold').fontSize(20).fillColor(riskColor).text(phishing ? 'Phishing' : 'Legitimate', left + 16, boxTop + 12);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('Model prediction', left + 16, boxTop + 38);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(riskColor).text(`${scan.riskScore} / 100`, left + 200, boxTop + 12);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(`Risk score - ${RISK_LABEL[scan.riskCategory]}`, left + 200, boxTop + 38);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.navy).text(pct(scan.phishingProbability), left + 380, boxTop + 12);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('Estimated phishing probability', left + 380, boxTop + 38);
    doc.y = boxTop + 78;

    // ---- scan details ----------------------------------------------------------------------------
    heading('Scan details');
    const rows = [
      ['Submitted URL', breakLong(scan.submittedUrl)],
      ...(scan.normalizedUrl !== scan.submittedUrl ? [['Analyzed as', breakLong(scan.normalizedUrl)]] : []),
      ['Scan date and time', fmtUtc(scan.scannedAt)],
      ['Prediction', phishing ? 'Phishing' : 'Legitimate'],
      ['Risk score', `${scan.riskScore} out of 100`],
      ['Risk category', RISK_LABEL[scan.riskCategory]],
      ['Prediction probability', `${pct(scan.phishingProbability)} (calibrated probability of phishing)`],
      ['Model', `${scan.modelName}, version ${scan.modelVersion}`],
      ['Feature extractor version', scan.extractorVersion],
      ['Report ID', scan.id],
    ];
    for (const [label, value] of rows) {
      const h = doc.font('Helvetica').fontSize(10).heightOfString(String(value), { width: width - 150 });
      ensureSpace(h + 8);
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text(label, left, y, { width: 140 });
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(String(value), left + 150, y, { width: width - 150 });
      doc.y = y + Math.max(h, 12) + 6;
    }

    // ---- suspicious characteristics ---------------------------------------------------------------
    heading('Suspicious characteristics');
    if (scan.riskFactors.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(
        'None of the known risk characteristics were triggered by this URL. This does not mean the website is safe: the model only sees the text of the URL.',
        left, doc.y, { width },
      );
    } else {
      for (const f of scan.riskFactors) {
        const body = pdfSafe(f.description);
        const h = doc.font('Helvetica').fontSize(9.5).heightOfString(body, { width: width - 14 });
        ensureSpace(h + 34);
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.navy).text(`${pdfSafe(f.title)}  `, left, doc.y, { continued: true });
        doc.font('Helvetica').fontSize(9).fillColor(COLORS[f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'muted']).text(`(${SEVERITY_LABEL[f.severity]})`);
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text).text(body, left + 14, doc.y + 1, { width: width - 14 });
        doc.moveDown(0.6);
      }
    }

    // ---- what moved the score ----------------------------------------------------------------------
    const top = (scan.contributions || []).slice(0, 5);
    if (top.length) {
      heading('Largest influences on the score');
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.muted).text(
        'Change in estimated phishing probability when the characteristic is replaced by the typical training-data value.',
        left, doc.y, { width },
      );
      doc.moveDown(0.4);
      for (const c of top) {
        ensureSpace(16);
        const pts = `${c.influence > 0 ? '+' : '-'}${(Math.abs(c.influence) * 100).toFixed(1)} points ${c.influence > 0 ? 'toward phishing' : 'toward legitimate'}`;
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(`${pdfSafe(c.feature)} = ${c.value}   (${pts})`, left, doc.y, { width });
      }
    }

    // ---- disclaimer ----------------------------------------------------------------------------------
    ensureSpace(110);
    doc.moveDown(1);
    const dTop = doc.y;
    const dh = doc.font('Helvetica').fontSize(9.5).heightOfString(DISCLAIMER, { width: width - 24 });
    doc.roundedRect(left, dTop, width, dh + 38, 6).fillAndStroke('#f3f6fd', COLORS.line);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.navy).text('Disclaimer', left + 12, dTop + 10);
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text).text(DISCLAIMER, left + 12, dTop + 25, { width: width - 24 });

    // ---- footer (last page). Kept inside the bottom margin so PDFKit never starts an extra blank page. -------
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
      `Generated by LinkShield on ${fmtUtc(generatedAt)}`,
      left, doc.page.height - doc.page.margins.bottom - 24, { width, align: 'center', lineBreak: false },
    );
    doc.end();
  });
}
