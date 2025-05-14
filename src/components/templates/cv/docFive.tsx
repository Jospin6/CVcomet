// components/CvDocument.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next'
import { User } from '@/redux/user/userSlice';
import { CvProps } from '@/helpers/schema';
import { formatDateToMonthYear } from '@/lib/utils';

const styles = StyleSheet.create({
    page: {
        padding: 32,
        fontSize: 11,
        fontFamily: 'Helvetica',
    },
    section: { marginBottom: 12 },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 14, marginBottom: 4, fontWeight: "bold", borderBottom: '1 solid black', borderTop: '1 solid black', paddingTop: 3, paddingBottom: 3 },
    text: { marginBottom: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    link: {
        textDecoration: 'none',
        color: 'black',
    },
    listItem: {
        marginLeft: 8,
        marginBottom: 2,
    },
    displayFlex: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: '2',
        width: '100%',
    },
    subHeading: {
        fontWeight: 'bold',
        fontSize: 10,
    },
    smallText: {
        fontSize: 9,
    },
});

export const DocFive = ({ user, cv }: { user: User, cv: CvProps }) => {
    const { t } = useTranslation();
    const formatDate = (date: string | number | Date) => date ? new Date(date).toLocaleDateString("en-GB", { month: 'short', year: 'numeric' }) : '';
    return <Document>
        <Page size="A4" style={styles.page}>

            <View style={styles.section}>
                <Text style={styles.title}>{user?.name?.toUpperCase() ?? 'No name'}</Text>
                <Text style={styles.text}>{cv.title?.toUpperCase()}</Text>
                <Text style={styles.text}>
                    {user?.phone && `${user.phone} | `}
                    {user?.email && <Link style={styles.link} src={`mailto:${user.email}`}>{user.email}</Link>}
                </Text>
            </View>

            {cv.summary && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('summary')}</Text>
                    <Text>{cv.summary}</Text>
                </View>
            )}

            {cv.skills && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('skills')}</Text>
                    {cv.skills.map((skill, i) => (
                        <View key={i}>
                            {skill.hardskills && <Text style={styles.listItem}>• {skill.hardskills}</Text>}
                            {skill.softskills && <Text style={styles.listItem}>• {skill.softskills}</Text>}
                            {skill.tools && <Text style={styles.listItem}>• {skill.tools}</Text>}
                        </View>
                    ))}
                </View>
            )}

            {cv.experiences && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('experience')}</Text>
                    {cv.experiences.map((exp, i) => (
                        <View key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
                            <View
                                style={styles.displayFlex}
                            >
                                <Text style={{ fontWeight: "bold" }}>{exp.title}, {exp.company}</Text>
                                <Text>{formatDate(exp.start)} – {exp.end ? formatDate(exp.end) : 'Present'} | {exp.location}</Text>
                            </View>

                            {exp.description && exp.description.map((desc, i) => (
                                <Text key={i} style={styles.listItem}>• {desc}</Text>
                            ))}
                        </View>
                    ))}
                </View>
            )}

            {cv.projects && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('projects')}</Text>
                    {cv.projects.map((project, i) => (
                        <View key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
                            <Text style={{ fontWeight: 'bold' }}>{project.title}</Text>
                            <Text style={{fontSize: 11}}>{project.description}</Text>
                            <Text style={{fontSize: 11}}>Tech: {project.technologies}</Text>
                        </View>
                    ))}
                </View>
            )}

            {cv.educations && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('education')}</Text>
                    {cv.educations.map((edu, i) => (
                        <View key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
                            <View
                                style={styles.displayFlex}
                            >
                                <Text style={{ fontWeight: 'bold' }}>{edu.degree}</Text>
                                <Text style={{fontSize: 11}}>
                                    {formatDateToMonthYear(edu.start)} - {edu.end ? formatDateToMonthYear(edu.end) : "Present"}
                                </Text>
                            </View>

                            <Text style={{fontSize: 11}}>{edu.school}</Text>
                            {edu.description && edu.description.map((desc, i) => (
                                <Text key={i} style={styles.listItem}>• {desc}</Text>
                            ))}
                        </View>
                    ))}
                </View>
            )}

            {(cv.languages?.length || cv.certifications?.length) && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('additional')}</Text>
                    {(cv.languages ?? []).length > 0 && (
                        <Text>
                            Languages: {(cv.languages ?? []).map((lang: any) => lang.language).join(', ')}
                        </Text>
                    )}
                    {cv.certifications && cv.certifications.length > 0 && (
                        <Text>
                            Certifications: {cv.certifications.map((cert: any) => `${cert.title}, ${cert.issuer}`).join(' | ')}
                        </Text>
                    )}
                </View>
            )}

        </Page>
    </Document>

};
