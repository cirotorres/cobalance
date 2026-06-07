
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({

  page: {
    padding: 32,
    fontSize: 12,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
  },

  /* HEADER */

  header: {
    marginBottom: 28,
    paddingBottom: 18,
    borderBottom: '2px solid #E5E7EB',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },

  subtitle: {
    fontSize: 11,
    color: '#6B7280',
  },

  /* PARTICIPANT CARD */

  participantCard: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: 18,
    marginBottom: 24,
  },

  participantName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  infoRow: {
    marginBottom: 6,
    fontSize: 12,
  },

  /* SUMMARY */

  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 8,
    border: '1px solid #E5E7EB',
  },

  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },

  /* SECTION */

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 14,
    color: '#111827',
  },

  /* TABLE */

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottom: '1px solid #E5E7EB',
    alignItems: 'center',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    marginTop: 2,
  },

  totalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
  },

  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },

  columnIndex: {
    width: '10%',
    fontWeight: 'bold',
  },

  columnDescription: {
    width: '65%',
    paddingRight: 10,
  },

  columnAmount: {
    width: '25%',
    textAlign: 'right',
    fontWeight: 'bold',
  },

  columnParcela: {
    width: '25%',
    textAlign: 'right',
    fontWeight: 'bold',
  },

  /* FOOTER */

  footer: {
    marginTop: 40,
    paddingTop: 12,
    borderTop: '1px solid #E5E7EB',
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },

});

export default function ParticipantPDF({
  participant,
  total,
  items,
}) {

  const totalFormatted = total.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (

    <Document>

      <Page size="A4" style={styles.page}>

        {/* HEADER */}

        <View style={styles.header}>

          <Text style={styles.title}>
            Relatório Financeiro
          </Text>

          <Text style={styles.subtitle}>
            Documento gerado automaticamente pelo sistema
          </Text>

        </View>

        {/* PARTICIPANT */}

        <View style={styles.participantCard}>

          <Text style={styles.summaryLabel}>
            Participante:
          </Text>

          <Text style={styles.participantName}>
            {participant.name}
          </Text>

          {/* <Text style={styles.infoRow}>
            ID do participante: {participant.id}
          </Text> */}

          {/* <Text style={styles.infoRow}>
            Data de emissão:{' '}
            {new Date().toLocaleDateString('pt-BR')}
          </Text> */}

        </View>

        {/* SUMMARY */}

        <View style={styles.summaryContainer}>

          <View style={styles.summaryCard}>

            <Text style={styles.summaryLabel}>
              Total gasto
            </Text>

            <Text style={styles.summaryValue}>
              {totalFormatted}
            </Text>

          </View>

          <View style={styles.summaryCard}>

            <Text style={styles.summaryLabel}>
              Transações
            </Text>

            <Text style={styles.summaryValue}>
              {items.length}
            </Text>

          </View>

        </View>

        {/* TRANSACTIONS */}

        <View>

          <Text style={styles.sectionTitle}>
            Histórico de Transações
          </Text>

          {/* HEADER */}

          <View style={styles.tableHeader}>

            <Text style={styles.columnIndex}>
              #
            </Text>

            <Text style={styles.columnDescription}>
              Descrição
            </Text>

            <Text style={styles.columnParcela}>
              Parcela
            </Text>

            <Text style={styles.columnAmount}>
              Valor
            </Text>

          </View>

          {/* ROWS */}

          {items.map((item, index) => (

            <View
              key={item.id}
              style={styles.tableRow}
            >

              <Text style={styles.columnIndex}>
                {index + 1}
              </Text>

              <Text style={styles.columnDescription}>
                {item.description}
              </Text>

              <Text style={styles.columnParcela}>
                {item.installment_total != 1 && 
                `${item.installment_number} / ${item.installment_total}` }
              </Text>               

              <Text style={styles.columnAmount}>
                {item.amount.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </Text>

            </View>

          ))}

          {/* TOTAL ROW */}

          <View style={styles.totalRow}>

            <Text style={styles.totalLabel}>
              Total
            </Text>

            <Text style={styles.totalValue}>
              {totalFormatted}
            </Text>

          </View>

        </View>

        {/* FOOTER */}

        <View style={styles.footer}>

          <Text>
            Relatório emitido em{' '}
            {new Date().toLocaleString('pt-BR')}
          </Text>

        </View>

      </Page>

    </Document>
  );
}

