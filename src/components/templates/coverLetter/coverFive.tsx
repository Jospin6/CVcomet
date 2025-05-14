import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { CoverLetterProps } from '@/helpers/schema';
import { User } from '@/redux/user/userSlice';
import { CurrentDate } from '@/components/ui/currentDate';

const styles = StyleSheet.create({
    page: {
        padding: '20mm',
        fontFamily: 'Helvetica',
        fontSize: 12,
        width: '210mm',
        height: '297mm',
        boxSizing: 'border-box',
    },
    headerSection: {
        paddingBottom: 12,
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    subHeaderText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    contactInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderTopWidth: 1,
        borderColor: '#000',
        paddingVertical: 8,
    },
    recipientSection: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
    },
    recipientName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    date: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'right',
    },
    bodySection: {
        marginTop: 16,
    },
    bodyText: {
        marginTop: 4,
    },
    closing: {
        marginTop: 20,
    },
});

const CoverFive = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    
    return <Document>
        <Page size="A4" style={styles.page}>
            {/* Header Section */}
            <View style={styles.headerSection}>
                <Text style={styles.headerText}>{user?.name}</Text>
                <Text style={styles.subHeaderText}>{coverLetter.sendertitle?.toUpperCase()}</Text>
            </View>

            {/* Contact Information Section */}
            <View style={styles.contactInfo}>
                <Text>{user?.phone}</Text>
                <Text>{user?.email}</Text>
                <Text>{user?.address}</Text>
            </View>

            {/* Recipient Information Section */}
            <View style={styles.recipientSection}>
                <View>
                    {coverLetter.companyName && (
                        <Text style={{...styles.bodyText, fontWeight: 'bold'}}>{coverLetter.companyName}</Text>
                    )}
                    {coverLetter.companyAddress && (
                        <Text style={styles.bodyText}>{coverLetter.companyAddress}</Text>
                    )}
                    <Text style={styles.date}><CurrentDate/></Text>
                </View>
            </View>

            {/* Salutation Section */}
            {/* {coverLetter.recipientName && (
                <Text style={styles.recipientName}>{coverLetter.recipientName},</Text>
            )} */}

            {/* Body Section */}
            <View style={styles.bodySection}>
                {coverLetter.introduction && (
                    <Text style={styles.bodyText}>{coverLetter.introduction}</Text>
                )}
                {coverLetter.body && <Text style={styles.bodyText}>{coverLetter.body}</Text>}
                {coverLetter.conclusion && (
                    <Text style={styles.bodyText}>{coverLetter.conclusion}</Text>
                )}
            </View>

            {/* Closing Section */}
            <View style={styles.closing}>
                <Text style={styles.bodyText}>{user?.name}</Text>
            </View>
        </Page>
    </Document>
}

export default CoverFive;
