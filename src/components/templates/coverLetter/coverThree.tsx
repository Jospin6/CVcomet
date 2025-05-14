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
        color: '#1b1b1b'
    },
    header: {
        marginBottom: 12,
        paddingBottom: 16,
        borderBottom: '1px solid black',
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000'
    },
    senderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    contactInfo: {
        
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
        
    },
    date: {
        
    },
    bodySection: {
        marginTop: 16,
    },
    bodyText: {
        
    },
    closing: {
        marginTop: 20,
        fontWeight: 'bold',
    },
    displayFlex: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: '2',
        width: '100%',
    }
});

const CoverThree = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => (
    <Document>
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
            <View style={{...styles.recipientSection, ...styles.displayFlex}}>
                <View>
                    {coverLetter.companyName && (
                        <Text style={styles.recipientName}>{coverLetter.companyName}</Text>
                    )}
                    {coverLetter.companyAddress && <Text>{coverLetter.companyAddress}</Text>}
                </View>
                <View>
                    <Text style={styles.date}><CurrentDate/></Text>
                </View>
            </View>

            {/* Salutation Section */}
            {/* {coverLetter.recipientName && (
                <Text style={{ ...styles.bodyText, marginBottom: 12 }}>
                    {`${coverLetter.recipientName},`}
                </Text>
            )} */}

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
)

export default CoverThree;
