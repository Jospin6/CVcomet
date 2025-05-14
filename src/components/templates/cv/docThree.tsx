// components/MyCvPdf.jsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Link } from '@react-pdf/renderer';
import { User } from '@/redux/user/userSlice';
import { CvProps } from '@/helpers/schema';
import { useTranslation } from 'react-i18next'

const formatDate = (date: string | number | Date) => date ? new Date(date).toLocaleDateString("en-GB", { month: 'short', year: 'numeric' }) : '';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  section: {
    marginBottom: 10,
    borderBottom: '1 solid black',
    paddingBottom: 6,
  },
  header: {
    textAlign: 'center',
    marginBottom: 10,
  },
  bold: {
    fontWeight: 'bold',
  },
  listItem: {
    marginLeft: 10,
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

const DocThree = ({ user, cv, t }: { user: User, cv: CvProps, t: (key: string) => string }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{user?.name?.toUpperCase() ?? "No name"}</Text>
        <Text>{cv.title}</Text>
        <Text style={{ borderBottom: '1 solid black', borderTop: '1 solid black', paddingBottom: 5, paddingTop: 5, marginTop: 5, marginBottom: 5 }}>
          {user?.phone && `${user.phone} | `}
          {user?.email && <Link style={styles.link} src={`mailto:${user.email}`}>{user.email}</Link>}
        </Text>
      </View>

      {cv.summary && (
        <View style={styles.section}>
          <Text style={styles.bold}>{t("summary")}</Text>
          <Text>{cv.summary}</Text>
        </View>
      )}

      {cv.skills && (
        <View style={styles.section}>
          <Text style={styles.bold}>{t("skills")}</Text>
          {cv.skills.map((skill, index) => (
            <View key={index}>
              {skill.hardskills && <Text>Technical: {skill.hardskills}</Text>}
              {skill.softskills && <Text>Soft: {skill.softskills}</Text>}
              {skill.tools && <Text>Tools: {skill.tools}</Text>}
            </View>
          ))}
        </View>
      )}

      {cv.experiences && (
        <View style={styles.section}>
          <Text style={styles.bold}>{t("experience")}</Text>
          {cv.experiences.map((exp, index) => (
            <View key={index}>
              <View
                style={styles.displayFlex}
              >
                <Text style={{ fontWeight: "500" }}>{exp.title}, {exp.company}</Text>
                <Text>{formatDate(exp.start)} – {exp.end ? formatDate(exp.end) : 'Present'} | {exp.location}</Text>
              </View>
              {exp.description?.map((desc, i) => (
                <Text key={i} style={styles.listItem}>• {desc}</Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {cv.educations && (
        <View style={styles.section}>
          <Text style={styles.bold}>{t("education")}</Text>
          {cv.educations.map((edu, index) => (
            <View key={index}>
              <View
                style={styles.displayFlex}
              >
                <Text style={{ fontWeight: '500' }}>{edu.degree}</Text>
                <Text>{formatDate(edu.start)} - {edu.end ? formatDate(edu.end) : 'Present'}</Text>
              </View>
              <Text>{edu.school}</Text>
              {edu.description?.map((desc, i) => (
                <Text key={i} style={styles.listItem}>• {desc}</Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {cv.projects && (
        <View style={styles.section}>
          <Text style={styles.bold}>{t("projects")}</Text>
          {cv.projects.map((proj, index) => (
            <View key={index}>
              <Text>{proj.title}</Text>
              <Text>{proj.description}</Text>
              <Text>Tech: {proj.technologies}</Text>
            </View>
          ))}
        </View>
      )}

      {((cv.languages || []).length > 0 || (cv.certifications || []).length > 0) && (
        <View>
          <Text style={styles.bold}>{t("additional")}</Text>
          {cv.languages && (
            <Text>Languages: {cv.languages.map(lang => lang.language).join(", ")}</Text>
          )}
          {(cv.certifications && cv.certifications.length > 0) && (
            <Text>Certifications: {cv.certifications.map(cert => `${cert.title}, ${cert.issuer}`).join("; ")}</Text>
          )}
        </View>
      )}
    </Page>
  </Document>
)

export default DocThree;
