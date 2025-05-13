// components/MyCvPdf.jsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { User } from '@/redux/user/userSlice';
import { CvProps } from '@/helpers/schema';

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
  }
});

const DocThree = ({ user, cv }: {user: User, cv: CvProps}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 16 }}>{user?.name ?? "No name"}</Text>
        <Text>{cv.title}</Text>
        <Text>{user?.email} {user?.linkedin && `| LinkedIn`} {user?.github && `| GitHub`}</Text>
      </View>

      {cv.summary && (
        <View style={styles.section}>
          <Text style={styles.bold}>Summary</Text>
          <Text>{cv.summary}</Text>
        </View>
      )}

      {cv.skills && (
        <View style={styles.section}>
          <Text style={styles.bold}>Skills</Text>
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
          <Text style={styles.bold}>Experience</Text>
          {cv.experiences.map((exp, index) => (
            <View key={index}>
              <Text>{exp.title}, {exp.company} | {exp.start} – {exp.end ?? 'Present'} | {exp.location}</Text>
              {exp.description?.map((desc, i) => (
                <Text key={i} style={styles.listItem}>• {desc}</Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {cv.educations && (
        <View style={styles.section}>
          <Text style={styles.bold}>Education</Text>
          {cv.educations.map((edu, index) => (
            <View key={index}>
              <Text>{edu.degree} | {edu.school}</Text>
              <Text>{edu.start} – {edu.end ?? 'Present'}</Text>
              {edu.description?.map((desc, i) => (
                <Text key={i} style={styles.listItem}>• {desc}</Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {cv.projects && (
        <View style={styles.section}>
          <Text style={styles.bold}>Projects</Text>
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
        <View style={styles.section}>
          <Text style={styles.bold}>Additional</Text>
          {cv.languages && (
            <Text>Languages: {cv.languages.map(lang => lang.language).join(", ")}</Text>
          )}
          {cv.certifications && (
            <Text>Certifications: {cv.certifications.map(cert => `${cert.title}, ${cert.issuer}`).join("; ")}</Text>
          )}
        </View>
      )}
    </Page>
  </Document>
);

export default DocThree;
