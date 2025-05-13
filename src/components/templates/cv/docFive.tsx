// components/CvDocument.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next'
import { User } from '@/redux/user/userSlice';
import { CvProps } from '@/helpers/schema';

const styles = StyleSheet.create({
    page: {
        padding: 32,
        fontSize: 11,
        fontFamily: 'Helvetica',
    },
    section: { marginBottom: 12 },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 14, marginBottom: 4 },
    text: { marginBottom: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
});

export const DocFive = ({ user, cv }: { user: User, cv: CvProps }) => {
    const { t } = useTranslation();
    return <Document>
        <Page size="A4" style={styles.page}>

            <View style={styles.section}>
                <Text style={styles.title}>{user?.name ?? 'No name'}</Text>
                <Text style={styles.text}>{cv.title}</Text>
                <Text style={styles.text}>
                    {user?.linkedin && `LinkedIn | `}
                    {user?.email && user.email}
                    {user?.github && ` | GitHub`}
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
                            {skill.hardskills && <Text>- {skill.hardskills}</Text>}
                            {skill.softskills && <Text>- {skill.softskills}</Text>}
                            {skill.tools && <Text>- {skill.tools}</Text>}
                        </View>
                    ))}
                </View>
            )}

            {cv.experiences && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('experience')}</Text>
                    {cv.experiences.map((exp, i) => (
                        <View key={i}>
                            <View style={styles.row}>
                                <Text>{exp.title}, {exp.company}</Text>
                                <Text>{exp.start} – {exp.end ?? 'Present'} | {exp.location}</Text>
                            </View>
                            {exp.description && exp.description.map((desc: string, j: number) => (
                                <Text key={j}>• {desc}</Text>
                            ))}
                        </View>
                    ))}
                </View>
            )}

            {cv.projects && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('projects')}</Text>
                    {cv.projects.map((project, i) => (
                        <View key={i}>
                            <Text>{project.title}</Text>
                            <Text>{project.description}</Text>
                            <Text>Tools: {project.technologies}</Text>
                        </View>
                    ))}
                </View>
            )}

            {cv.educations && (
                <View style={styles.section}>
                    <Text style={styles.subtitle}>{t('education')}</Text>
                    {cv.educations.map((edu, i) => (
                        <View key={i}>
                            <View style={styles.row}>
                                <Text>{edu.degree}</Text>
                                <Text>{edu.start} - {edu.end ?? 'Present'}</Text>
                            </View>
                            <Text>{edu.school}</Text>
                            {edu.description?.map((desc: string, j: number) => (
                                <Text key={j}>• {desc}</Text>
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
