import React from "react";
import { Page, Text, View, Document, StyleSheet, Link } from "@react-pdf/renderer";
import { User } from "@/redux/user/userSlice";
import { CvProps } from "@/helpers/schema";
import { useTranslation } from 'react-i18next'

// Exemple de style inspiré de ton Tailwind
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    padding: 20,
  },
  main: {
    width: "66%",
    paddingRight: 10,
  },
  sidebar: {
    width: "34%",
    backgroundColor: "#ffffff",
    paddingLeft: 10,
  },
  section: {
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  text: {
    fontSize: 10,
    marginBottom: 2,
  },
  listItem: {
    fontSize: 10,
    marginLeft: 10,
  },
  link: {
    textDecoration: 'none',
    color: 'black',
  }
});

const DocTwo = ({ user, cv, t }: { user: User, cv: CvProps, t: (key: string) => string }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Main content */}
      <View style={styles.main}>
        <View style={styles.section}>
          <Text style={styles.title}>{user?.name ?? "No name"}</Text>
          <Text style={styles.text}>{cv.title}</Text>
        </View>

        {cv.summary && (
          <View style={styles.section}>
            <Text style={styles.text}>{cv.summary}</Text>
          </View>
        )}

        {cv.experiences && cv.experiences?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t("experience")}</Text>
            {cv.experiences.map((exp, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <Text style={styles.text}>{exp.title} - {exp.company}</Text>
                <Text style={styles.text}>{exp.start} - {exp.end ?? "Present"} | {exp.location}</Text>
                {exp.description?.map((desc, j) => (
                  <Text key={j} style={styles.listItem}>• {desc}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.educations && cv.educations?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t("education")}</Text>
            {cv.educations.map((edu, i) => (
              <View key={i}>
                <Text style={styles.text}>{edu.degree} - {edu.school}</Text>
                <Text style={styles.text}>{edu.start} - {edu.end ?? "Present"}</Text>
                {edu.description?.map((desc, j) => (
                  <Text key={j} style={styles.listItem}>• {desc}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.projects && cv.projects?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t("projects")}</Text>
            {cv.projects.map((project, i) => (
              <View key={i}>
                <Text style={styles.text}>{project.title}</Text>
                <Text style={styles.text}>{project.description}</Text>
                <Text style={styles.text}>Tech: {project.technologies}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.section}>
          <Text style={styles.subtitle}>{t("contact")}</Text>
          {user?.phone && <Text style={styles.text}>{user.phone}</Text>}
          {user?.email && <Text style={styles.text}>
            <Link style={styles.link} src={`mailto:${user.email}`}>{user.email}</Link>
          </Text>}
        </View>

        {cv.skills && cv.skills?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t("skills")}</Text>
            {cv.skills.map((skill, i) => (
              <View key={i}>
                {skill.hardskills && <Text style={{ fontWeight: '200', fontSize: 10 }}><Text style={{ fontWeight: 'bold', fontSize: 10 }}>Technical:</Text> {skill.hardskills}</Text>}
                {skill.softskills && <Text style={{ fontWeight: '200', fontSize: 10 }}><Text style={{ fontWeight: 'bold', fontSize: 10 }}>Soft:</Text> {skill.softskills}</Text>}
                {skill.tools && <Text style={{ fontWeight: '200', fontSize: 10 }}><Text style={{ fontWeight: 'bold', fontSize: 10 }}>Tools:</Text> {skill.tools}</Text>}
              </View>
            ))}
          </View>
        )}

        {cv.languages && cv.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t("languages")}</Text>
            {cv.languages.map((lang, i) => (
              <Text key={i} style={styles.text}>{lang.language} - {lang.level}</Text>
            ))}
          </View>
        )}

        {(cv.certifications ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t("certifications")}</Text>
            {(cv.certifications ?? []).map((cert, i) => (
              <View key={i}>
                <Text style={styles.text}>{cert.title} – {cert.issuer}</Text>
                <Text style={styles.text}>{cert.date}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Page>
  </Document>
)

export default DocTwo;
