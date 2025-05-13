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
        marginBottom: 16,
        paddingBottom: 16,
        borderBottom: '1px solid black',
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
        marginBottom: 8,
    },
    recipientSection: {
        marginBottom: 16,
    },
    recipientName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    bodySection: {
        marginTop: 12,
        marginBottom: 12,
    },
    conclusion: {
        marginTop: 12,
    },
    signature: {
        marginTop: 20,
    },
});

const CoverTwo = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    return <Document>
        <Page size="A4" style={styles.page}>
            {/* Header - User Information */}
            <View style={styles.header}>
                <Text style={styles.headerText}>{user?.name}</Text>
                <Text style={styles.senderTitle}>{coverLetter.sendertitle?.toUpperCase()}</Text>
                <View style={styles.contactInfo}>
                    <Text>{user?.phone}</Text>
                    <Text>{user?.email}</Text>
                    <Text>{user?.address}</Text>
                </View>
            </View>

            <View style={styles.bodySection}>
                {/* Recipient Information */}
                {coverLetter.recipientName && (
                    <View style={styles.recipientSection}>
                        <Text style={styles.recipientName}>{coverLetter.companyName}</Text>
                        <Text>{coverLetter.companyAddress}</Text>
                    </View>
                )}

                {/* Salutation */}
                {coverLetter.recipientName && <Text>{`${coverLetter.recipientName},`}</Text>}

                {/* Cover Letter Body */}
                {coverLetter.introduction && <Text>{coverLetter.introduction}</Text>}
                {coverLetter.body && <Text style={{ marginTop: 8 }}>{coverLetter.body}</Text>}
                {coverLetter.conclusion && (
                    <Text style={styles.conclusion}>{coverLetter.conclusion}</Text>
                )}
            </View>

            {/* Closing */}
            <View style={styles.signature}>
                <Text>{user?.name}</Text>
            </View>
        </Page>
    </Document>
}

export default CoverTwo;
