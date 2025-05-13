import React from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Crée un style pour le document PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
});

const MyDocument: React.FC = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text>Mon composant React exporté en PDF!</Text>
        <Text>Ceci est un document PDF généré avec React.</Text>
      </View>
    </Page>
  </Document>
);

const PdfComponent: React.FC = () => {
  return (
    <div>
      <PDFDownloadLink document={<MyDocument />} fileName="document.pdf">
        {({ loading }) => (loading ? 'Chargement...' : 'Télécharger le PDF')}
      </PDFDownloadLink>
    </div>
  );
};

export default PdfComponent;
