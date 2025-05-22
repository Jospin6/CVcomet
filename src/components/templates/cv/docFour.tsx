import { CvProps } from '@/helpers/schema';
import { User } from '@/redux/user/userSlice';
import { Page, Text, View, Document, StyleSheet, Link } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next'
import { formatDateToMonthYear } from "@/lib/utils"

// Styles
const styles = StyleSheet.create({
    page: {
        padding: 24,
        backgroundColor: '#ffffff',
        fontSize: 10,
        width: '210mm',
        minHeight: '297mm',
    },
    section: {
        marginBottom: 12,
    },
    header: {
        borderBottom: '2 solid black',
        paddingBottom: 6,
        marginBottom: 8,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 10,
        textTransform: 'uppercase',
        fontWeight: 'medium',
    },
    contact: {
        fontSize: 10,
    },
    heading: {
        fontSize: 12,
        fontWeight: 'bold',
        borderBottom: '1 solid black',
        marginBottom: 4,
        paddingBottom: 2,
    },
    listItem: {
        marginLeft: 8,
        marginBottom: 2,
    },
    subHeading: {
        fontWeight: 'bold',
        fontSize: 10,
    },
    smallText: {
        fontSize: 9,
    },
    link: {
        textDecoration: 'none',
        color: 'black',
    },
    displayFlex: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: '2',
        width: '100%',
    }
});

const formatDate = (date: string | number | Date) => date ? new Date(date).toLocaleDateString("en-GB", { month: 'short', year: 'numeric' }) : '';

// Composant PDF
const DocFour = ({ user, cv, t }: { user: User, cv: CvProps, t: (key: string) => string }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.name}>{user?.name ?? "No name"}</Text>
                <Text style={styles.title}>{cv.title}</Text>
                <Text style={styles.contact}>
                    {user?.phone && `${user.phone} | `}
                    {user?.email && <Link style={styles.link} src={`mailto:${user.email}`}>{user.email}</Link>}
                    {user?.portfolio && <Text> | <Link style={styles.link} src={user.portfolio}>{t('portfolio')}</Link></Text>}
                </Text>
            </View>

            {/* Summary */}
            {cv.summary && (
                <View style={styles.section}>
                    <Text style={styles.heading}>{t("summary")}</Text>
                    <Text>{cv.summary}</Text>
                </View>
            )}

            {/* Experience */}
            {cv.experiences && (
                <View style={styles.section}>
                    <Text style={styles.heading}>{t("experience")}</Text>
                    {cv.experiences.map((exp, index) => (
                        <View key={index} style={{ marginTop: index > 0 ? 6 : 0 }}>
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

            {/* Projects */}
            {cv.projects && (
                <View style={styles.section}>
                    <Text style={styles.heading}>{t("projects")}</Text>
                    {cv.projects.map((project, index) => (
                        <View key={index} style={{ marginTop: index > 0 ? 6 : 0 }}>
                            <Text style={styles.subHeading}>{project.title}</Text>
                            <Text style={styles.smallText}>{project.description}</Text>
                            <Text style={styles.smallText}>Tech: {project.technologies}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Skills */}
            {cv.skills && (
                <View style={styles.section}>
                    <Text style={styles.heading}>{t("skills")}</Text>
                    {cv.skills.map((skill, index) => (
                        <View key={index}>
                            {skill.hardskills && <Text style={styles.listItem}>• {skill.hardskills}</Text>}
                            {skill.softskills && <Text style={styles.listItem}>• {skill.softskills}</Text>}
                            {skill.tools && <Text style={styles.listItem}>• {skill.tools}</Text>}
                        </View>
                    ))}
                </View>
            )}

            {/* Education */}
            {cv.educations && (
                <View style={styles.section}>
                    <Text style={styles.heading}>{t("education")}</Text>
                    {cv.educations.map((edu, index) => (
                        <View key={index} style={{ marginTop: index > 0 ? 6 : 0 }}>
                            <View
                                style={styles.displayFlex}
                            >
                                <Text style={{ fontWeight: 'bold' }}>{edu.degree}</Text>
                                <Text style={styles.smallText}>
                                    {formatDateToMonthYear(edu.start)} - {edu.end ? formatDateToMonthYear(edu.end) : "Present"}
                                </Text>
                            </View>

                            <Text style={styles.smallText}>{edu.school}</Text>
                            {edu.description && edu.description.map((desc, i) => (
                                <Text key={i} style={styles.listItem}>• {desc}</Text>
                            ))}
                        </View>
                    ))}
                </View>
            )}

            {/* Additional */}
            {(cv.languages && cv.languages.length > 0) || (cv.certifications && cv.certifications.length > 0) && (
                <View style={styles.section}>
                    <Text style={styles.heading}>{t("additional")}</Text>
                    {cv.languages && cv.languages.length > 0 && (
                        <Text>
                            <Text style={{ fontWeight: 'bold' }}>{t("languages")}</Text>
                            {cv.languages.map((lang, index) => (
                                <Text key={index}>{lang.language}{index < (cv.languages ?? []).length - 1 ? ', ' : ''}</Text>
                            ))}
                        </Text>
                    )}
                    {cv.certifications?.length > 0 && (
                        <Text>
                            <Text style={{ fontWeight: 'bold' }}>{t("certifications")}</Text>
                            {cv.certifications.map((cert, index) => (
                                <Text key={index}>{cert.title}, {cert.issuer}{index < (cv.certifications?.length ?? 0) - 1 ? '; ' : ''}</Text>
                            ))}
                        </Text>
                    )}
                </View>
            )}
        </Page>
    </Document>
)

export default DocFour;
