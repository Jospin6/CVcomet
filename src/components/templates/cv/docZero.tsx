import React from "react";
import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import { User } from "@/redux/user/userSlice";
import { CvProps } from "@/helpers/schema";
import { useTranslation } from 'react-i18next'

// Exemple de fonction pour formater les dates
const formatDate = (date: string | number | Date) => date ? new Date(date).toLocaleDateString("en-GB", { month: 'short', year: 'numeric' }) : '';

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 11,
        fontFamily: "Helvetica",
        backgroundColor: "#ffffff",
    },
    header: {
        textAlign: "center",
        marginBottom: 10,
        paddingBottom: 6,
    },
    section: {
        marginBottom: 10,
        paddingBottom: 3,
    },
    title: {
        fontSize: 24,
        textTransform: "uppercase",
        fontWeight: "bold",
    },
    subtitle: {
        fontSize: 12,
        textTransform: "uppercase",
        fontWeight: "medium",
    },
    linkRow: {
        fontSize: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 3,
        borderBottom: "1px solid black",
        paddingBottom: 2,
    },
    bulletList: {
        marginLeft: 10,
    },
    bulletItem: {
        marginBottom: 2,
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

const DocZero = ({ user, cv, t }: { user: User, cv: CvProps, t: (key: string) => string }) => (
    <Document>
        <Page size="A4" style={styles.page}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{user?.name ?? "No name"}</Text>
                <Text style={styles.subtitle}>{cv.title}</Text>
                <Text style={styles.linkRow}>
                    {user?.phone && `${user.phone} | `}
                    {user?.email && <Link style={styles.link} src={`mailto:${user.email}`}>{user.email}</Link>}
                    {user?.portfolio && <Text> | <Link style={styles.link} src={user.portfolio}>{t('portfolio')}</Link></Text>}
                </Text>
            </View>

            {/* Summary */}
            {cv.summary && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("summary")}</Text>
                    <Text>{cv.summary}</Text>
                </View>
            )}

            {/* Skills */}
            {cv.skills && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("skills")}</Text>
                    {cv.skills.map((skill, index) => (
                        <View key={index}>
                            {skill.hardskills && <Text><Text style={{ fontWeight: 'bold' }}>{t("technical")}:</Text> {skill.hardskills}</Text>}
                            {skill.softskills && <Text><Text style={{ fontWeight: 'bold' }}>{t("soft")}:</Text> {skill.softskills}</Text>}
                            {skill.tools && <Text><Text style={{ fontWeight: 'bold' }}>{t("tools")}:</Text> {skill.tools}</Text>}
                        </View>
                    ))}
                </View>
            )}

            {/* Experience */}
            {cv.experiences && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("experience")}</Text>
                    {cv.experiences.map((exp, index) => (
                        <View key={index}>
                            <View
                                style={styles.displayFlex}
                            >
                                <Text style={{ fontWeight: "bold" }}>{exp.title}, {exp.company}</Text>
                                <Text>{formatDate(exp.start)} – {exp.end ? formatDate(exp.end) : 'Present'} | {exp.location}</Text>
                            </View>
                            <View style={styles.bulletList}>
                                {exp.description?.map((desc, i) => (
                                    <Text key={i} style={styles.bulletItem}>• {desc}</Text>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Education */}
            {cv.educations && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("education")}</Text>
                    {cv.educations.map((edu, index) => (
                        <View key={index}>
                            <View
                                style={styles.displayFlex}
                            >
                                <Text style={{ fontWeight: 'bold' }}>{edu.degree}</Text>
                                <Text>{formatDate(edu.start)} - {edu.end ? formatDate(edu.end) : 'Present'}</Text>
                            </View>
                            <Text>{edu.school}</Text>
                            <View style={styles.bulletList}>
                                {edu.description?.map((desc, i) => (
                                    <Text key={i} style={styles.bulletItem}>• {desc}</Text>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Projects */}
            {cv.projects && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("projects")}</Text>
                    {cv.projects.map((project, index) => (
                        <View key={index}>
                            <Text style={{ fontWeight: "bold" }}>{project.title}</Text>
                            <Text>{project.description}</Text>
                            <Text>Tech: {project.technologies}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Additional */}
            {((cv.languages ?? []).length || (cv.certifications ?? []).length) > 0 && (
                <View>
                    <Text style={styles.sectionTitle}>{t("additional")}</Text>
                    {(cv.languages ?? []).length > 0 && (
                        <Text>
                            <Text style={{ fontWeight: "bold" }}>{t("languages")}: </Text>
                            {(cv.languages ?? []).map((lang, index) => lang.language).join(", ")}
                        </Text>
                    )}
                    {(cv.certifications ?? []).length > 0 && (
                        <Text>
                            <Text style={{ fontWeight: "bold" }}>{t("certifications")}: </Text>
                            {(cv.certifications ?? []).map((cert, index) => `${cert.title} (${cert.issuer})`).join(", ")}
                        </Text>
                    )}
                </View>
            )}

        </Page>
    </Document>
)

export default DocZero;
