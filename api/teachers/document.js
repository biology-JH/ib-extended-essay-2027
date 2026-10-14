import {
  getTeacherPassword,
  getTeacherServerSecret,
  isTeacherAuthenticated,
  setPrivateResponseHeaders,
} from '../../lib/teacher-auth.js';
import { decryptTeacherDocument } from '../../lib/teacher-documents.js';

const DOCUMENTS = Object.freeze({
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
