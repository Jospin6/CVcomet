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
    header: {
        paddingBottom: 12,
        borderBottomWidth: 2,
        borderBottomColor: '#000',
        textAlign: 'center',
    },
    headerText: {
        textTransform: 'uppercase',
        fontSize: 18,
        fontWeight: 'bold',
    },
    subHeaderText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    recipientSection: {
        flexDirection: 'row',
        marginTop: 12,
        marginBottom: 12,
        justifyContent: 'space-between',
    },
    recipientName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
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
    footerSection: {
        marginTop: 24,
        marginBottom: 12,
        borderTopWidth: 2,
        borderTopColor: '#000',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerLeft: {
        fontSize: 14,
        fontWeight: 'medium',
    },
    footerRight: {
        fontSize: 12,
        textAlign: 'right',
    },
});

const CoverFour = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header Section */}
            <View style={styles.header}>
                <Text style={styles.headerText}>{user?.name}</Text>
                <Text style={styles.subHeaderText}>{coverLetter.sendertitle?.toUpperCase()}</Text>
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
                </View>
                <View>
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

            {/* Footer Section */}
            <View style={styles.footerSection}>
                <View style={{ flex: 2 }}>
                    <Text style={styles.footerLeft}>{user?.name}</Text>
                </View>
                <View style={{ flex: 2, alignItems: 'flex-end' }}>
                    <Text style={styles.footerRight}>{user?.address}</Text>
                    <Text style={styles.footerRight}>{user?.email}</Text>
                    <Text style={styles.footerRight}>{user?.phone}</Text>
                </View>
            </View>
        </Page>
    </Document>
)

export default CoverFour;
