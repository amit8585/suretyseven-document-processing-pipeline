function createPdfBuffer(label = 'document') {
  const body = `SuretySeven test PDF ${label}`;
  return Buffer.from(
    `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R/Contents 4 0 R>>endobj
4 0 obj<</Length ${body.length + 20}>>stream
BT /F1 12 Tf 20 100 Td (${body}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000101 00000 n
0000000190 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
290
%%EOF
`
  );
}

function fakeJob(documentId, attemptsMade = 0, attempts = 3) {
  return {
    data: { documentId },
    attemptsMade,
    opts: { attempts },
  };
}

module.exports = { createPdfBuffer, fakeJob };
