import {
  getTeacherPassword,
  getTeacherServerSecret,
  isTeacherAuthenticated,
  setPrivateResponseHeaders,
} from '../../lib/teacher-auth.js';
import { decryptTeacherDocument } from '../../lib/teacher-documents.js';

const DOCUMENTS = Object.freeze({
  'viva-voce-sample-questions': {
    file: 'viva-voce-sample-questions.eepdf',
    downloadName: 'Viva-Voce-Sample-Questions.pdf',
  },
  'design-technology-a-ee': {
    file: 'design-technology-a-ee.eepdf',
    downloadName: 'Design-Technology-A-Extended-Essay.pdf',
  },
  'design-technology-a-rpf': {
    file: 'design-technology-a-rpf.eepdf',
    downloadName: 'Design-Technology-A-Reflection-and-Progress-Form.pdf',
  },
  'design-technology-a-commentary': {
    file: 'design-technology-a-commentary.eepdf',
    downloadName: 'Design-Technology-A-Commentary.pdf',
  },
  'extended-essay': {
    file: 'equality-and-justice-extended-essay.eepdf',
    downloadName: 'Equality-and-Justice-Extended-Essay.pdf',
  },
  rpf: {
    file: 'reflection-and-progress-form.eepdf',
    downloadName: 'Reflection-and-Progress-Form-RPF.pdf',
  },
  commentaries: {
    file: 'equality-and-justice-commentaries.eepdf',
    downloadName: 'Equality-and-Justice-Essay-Commentaries.pdf',
  },
  'interdisciplinary-sample-c': {
    file: 'interdisciplinary-sample-c.eepdf',
    downloadName: 'Interdisciplinary-EE-Sample-C.pdf',
  },
  'culture-identity-expression-c': {
    file: 'culture-identity-expression-c.eepdf',
    downloadName: 'Culture-Identity-Expression-C-Commentary.pdf',
  },
  'language-a-criterion-e': {
    file: 'language-a-criterion-e-commentary.eepdf',
    downloadName: 'Language-A-Criterion-E-Commentary.pdf',
  },
  'language-a-rpf': {
    file: 'language-a-reflection-progress-form.eepdf',
    downloadName: 'Language-A-Reflection-and-Progress-Form.pdf',
  },
  'chemistry-criterion-e': {
    file: 'chemistry-criterion-e-commentary.eepdf',
    downloadName: 'Chemistry-Criterion-E-Commentary.pdf',
  },
  'chemistry-rpf': {
    file: 'chemistry-reflection-progress-form.eepdf',
    downloadName: 'Chemistry-Reflection-and-Progress-Form.pdf',
  },
});

export default function handler(req, res) {
  setPrivateResponseHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!getTeacherPassword() || !getTeacherServerSecret()) {
    return res.status(503).json({ error: 'Teacher access is temporarily unavailable.' });
  }

  if (!isTeacherAuthenticated(req)) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const documentId = typeof req.query?.id === 'string' ? req.query.id : '';
  const document = DOCUMENTS[documentId];
  if (!document) return res.status(404).json({ error: 'Document not found.' });

  let pdf;
  try {
    pdf = decryptTeacherDocument(document.file);
  } catch {
    return res.status(500).json({ error: 'Unable to retrieve the document.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${document.downloadName}"`);
  res.setHeader('Content-Length', pdf.length);
  res.status(200);
  return res.end(pdf);
}
