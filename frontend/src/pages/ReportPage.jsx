import React, { useState, useMemo, useRef } from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, PDFViewer, Image as PDFImage } from '@react-pdf/renderer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { useConversations } from '../hooks/useConversations';
import { FileText, Download, Play, Loader2, Database, Eye } from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Header from '../layout/Header';
import './ReportPage.css';

const API_BASE = 'http://localhost:8000/api';

// --- STYLES PDF ---
const pdfStyles = StyleSheet.create({
  page: { padding: 40, backgroundColor: '#ffffff' },
  header: { borderBottom: 2, borderBottomColor: '#0d5395', paddingBottom: 10, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between' },
  bankName: { fontSize: 14, fontWeight: 'bold', color: '#0d5395' },
  section: { marginBottom: 30, borderBottom: 1, borderBottomColor: '#eee', paddingBottom: 20 },
  title: { fontSize: 12, fontWeight: 'bold', marginBottom: 10 },
  sqlBox: { padding: 10, backgroundColor: '#f8fafc', marginBottom: 10, borderRadius: 4 },
  sqlText: { fontSize: 8, color: '#475569', fontFamily: 'Courier' },
  chartImage: { width: '100%', height: 200, marginTop: 15, marginBottom: 15 },
  analysis: { fontSize: 10, lineHeight: 1.5, textAlign: 'justify' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#94a3b8', textAlign: 'center' }
});

// --- DOCUMENT PDF ---
const MyReportDocument = ({ sections, title }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.header} fixed>
        <Text style={pdfStyles.bankName}>C DU MAROC</Text>
        <Text style={{ fontSize: 9, color: '#94a3b8' }}>RAPPORT DÉCISIONNEL</Text>
      </View>

      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>{title}</Text>

      {sections.map((sec, i) => (
        <View key={i} style={pdfStyles.section} wrap={false}>
          <Text style={pdfStyles.title}>{i + 1}. {sec.question}</Text>
          
          <View style={pdfStyles.sqlBox}>
            <Text style={pdfStyles.sqlText}>{sec.sql}</Text>
          </View>

          {/* C'est ici que l'image du graphique est injectée */}
          {sec.chartImage && (
            <PDFImage src={sec.chartImage} style={pdfStyles.chartImage} />
          )}

          <Text style={pdfStyles.analysis}>{sec.analysis}</Text>
        </View>
      ))}
      <Text style={pdfStyles.footer} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </Page>
  </Document>
);

const ReportPage = () => {
  const { conversations, activeChatId, setActiveChatId } = useConversations();
  const [loading, setLoading] = useState(false);
  const [reportSections, setReportSections] = useState([]);
  const chartRef = useRef(null); // Référence pour capturer le graph

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeChatId) || conversations[0];
  }, [conversations, activeChatId]);

  const generateReportData = async () => {
    setLoading(true);
    const sections = [];
    const botMessages = activeConversation.messages.filter(m => m.role === 'bot' && m.sql);

    for (let i = 0; i < botMessages.length; i++) {
      const msg = botMessages[i];
      try {
        const response = await axios.post(`${API_BASE}/report/analyze`, {
          question: msg.content.split('\n')[0],
          sql: msg.sql 
        });

        if (response.data.success) {
          // --- LOGIQUE DE CAPTURE DE GRAPHIQUE ---
          // On attend un court instant que le composant Recharts soit rendu "invisiblement"
          // Note : Dans un cas réel, on utiliserait un composant caché pour générer le PNG
          const canvas = await html2canvas(document.querySelector("#hidden-chart-gen"));
          const chartImageData = canvas.toDataURL("image/png");

          sections.push({
            question: msg.content.split('\n')[0],
            sql: msg.sql,
            analysis: response.data.analysis,
            chartImage: chartImageData // L'image convertie en texte
          });
        }
      } catch (err) { console.error(err); }
    }
    setReportSections(sections);
    setLoading(false);
  };

  return (
    <div className="chatpage">
      <Sidebar conversations={conversations} activeChatId={activeChatId} handleConversationSelect={setActiveChatId} formatDate={(d) => new Date(d).toLocaleDateString()}/>
      
      <main className="workspace">
        <Header activeConversationTitle="Générateur de Rapport" />

        <div className="report-container">
          <div className="report-controls">
            <div className="report-card">
              <button onClick={generateReportData} disabled={loading} className="btn-report btn-report-primary">
                {loading ? <Loader2 className="animate-spin" /> : <Play />} Préparer le rapport avec Graphiques
              </button>

              {reportSections.length > 0 && (
                <PDFDownloadLink document={<MyReportDocument sections={reportSections} title={activeConversation?.title} />} fileName="Rapport_Final.pdf">
                  <button className="btn-report btn-report-success"><Download /> Télécharger PDF</button>
                </PDFDownloadLink>
              )}
            </div>
          </div>

          <div className="pdf-preview-container">
            <div className="pdf-viewer-wrapper">
              {reportSections.length > 0 ? (
                <PDFViewer width="100%" height="100%"><MyReportDocument sections={reportSections} title={activeConversation?.title} /></PDFViewer>
              ) : (
                <div className="pdf-empty-state"><FileText size={60} /><p>En attente de génération...</p></div>
              )}
            </div>
          </div>
        </div>

        {/* COMPOSANT CACHÉ POUR GÉNÉRER LES IMAGES DES GRAPHIQUES */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
          <div id="hidden-chart-gen" style={{ width: '600px', height: '300px', background: 'white' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{name: 'PARTICULIER', value: 5300}, {name: 'PRO', value: 0}]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Bar dataKey="value" fill="#0d5395" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportPage;