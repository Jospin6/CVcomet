import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { CoverLetterProps } from '@/helpers/schema';
import { User } from '@/redux/user/userSlice';
import { CurrentDate } from '@/components/ui/currentDate';

const styles = StyleSheet.create({
    page: {
        padding: '20mm',
        fontSize: 12,
        fontFamily: 'Helvetica',
        width: '210mm',
        height: '297mm',
        boxSizing: 'border-box',
    },
    header: {
        marginBottom: 16,
    },
    senderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    contactInfo: {
        marginBottom: 8,
    },
    companyInfo: {
        marginTop: 16,
    },
    dateAndRecipient: {
        marginTop: 32,
    },
    body: {
        marginTop: 12,
    },
    conclusion: {
        marginTop: 12,
    },
    signature: {
        marginTop: 20,
        marginBottom: 8,
    },
});

const CoverZero = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{user?.name}</Text>
                <Text style={styles.senderTitle}>{coverLetter.sendertitle?.toUpperCase()}</Text>
            </View>

            <View style={styles.contactInfo}>
                <Text>{user?.phone}</Text>
                <Text>{user?.email}</Text>
                <Text>{user?.address}</Text>
            </View>

            {coverLetter.companyName && coverLetter.companyAddress && (
                <View style={styles.companyInfo}>
                    <Text style={{ fontWeight: 'bold' }}>{coverLetter.companyName}</Text>
                    <Text>{coverLetter.companyAddress}</Text>
                </View>
            )}

            <View style={styles.dateAndRecipient}>
                <Text><CurrentDate/></Text>
                {coverLetter.recipientName && <Text>{coverLetter.recipientName}</Text>}
            </View>

            <View style={styles.body}>
                {coverLetter.introduction && <Text>{coverLetter.introduction}</Text>}
                {coverLetter.body && <Text>{coverLetter.body}</Text>}
                {coverLetter.conclusion && <Text style={styles.conclusion}>{coverLetter.conclusion}</Text>}
            </View>

            <View style={styles.signature}>
                <Text>{user?.name}</Text>
            </View>
        </Page>
    </Document>
)

export default CoverZero;
