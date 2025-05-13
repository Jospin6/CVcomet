import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { CoverLetterProps } from '@/helpers/schema';
import { User } from '@/redux/user/userSlice';

const styles = StyleSheet.create({
    page: {
        padding: '20mm',
        fontFamily: 'Helvetica',
        fontSize: 12,
        width: '210mm',
        height: '297mm',
        boxSizing: 'border-box',
    },
    header: {
        marginBottom: 12,
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    senderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    contactInfo: {
        color: '#4A4A4A',
    },
    recipientSection: {
        marginTop: 12,
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
    },
    recipientName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    date: {
        color: '#666',
    },
    bodySection: {
        marginTop: 16,
    },
    bodyText: {
        color: '#4A4A4A',
    },
    closing: {
        marginTop: 20,
        fontWeight: 'bold',
    },
});

const CoverThree = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const date = new Date(Date.now());
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return <Document>
        <Page size="A4" style={styles.page}>
            {/* Header Section */}
            <View style={styles.header}>
                <Text style={styles.headerText}>{user?.name}</Text>
                <Text style={styles.senderTitle}>{coverLetter.sendertitle?.toUpperCase()}</Text>
                <View style={styles.contactInfo}>
                    <Text>{user?.phone}</Text>
                    <Text>{user?.email}</Text>
                    <Text>{user?.address}</Text>
                </View>
            </View>

            {/* Recipient Information */}
            <View style={styles.recipientSection}>
                <View>
                    {coverLetter.companyName && (
                        <Text style={styles.recipientName}>{coverLetter.companyName}</Text>
                    )}
                    {coverLetter.companyAddress && <Text>{coverLetter.companyAddress}</Text>}
                </View>
                <View>
                    <Text style={styles.date}>{`${day}/${month}/${year}`}</Text>
                </View>
            </View>

            {/* Salutation Section */}
            {coverLetter.recipientName && (
                <Text style={{ ...styles.bodyText, marginBottom: 12 }}>
                    {`${coverLetter.recipientName},`}
                </Text>
            )}

            {/* Body Section */}
            <View style={styles.bodySection}>
                {coverLetter.introduction && <Text style={styles.bodyText}>{coverLetter.introduction}</Text>}
                {coverLetter.body && <Text style={styles.bodyText}>{coverLetter.body}</Text>}
                {coverLetter.conclusion && <Text style={styles.bodyText}>{coverLetter.conclusion}</Text>}
            </View>

            {/* Closing */}
            <View style={styles.closing}>
                <Text style={styles.bodyText}>{user?.name}</Text>
            </View>
        </Page>
    </Document>
}

export default CoverThree;
