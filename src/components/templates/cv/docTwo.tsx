import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";
import { User } from "@/redux/user/userSlice";
import { CvProps } from "@/helpers/schema";

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
    backgroundColor: "#f5f5f5",
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
});

const DocTwo = ({ user, cv }: {user: User, cv: CvProps}) => {
    return  <Document>
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
            <Text style={styles.subtitle}>Expérience</Text>
            {cv.experiences.map((exp, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <Text style={styles.text}>{exp.title} – {exp.company}</Text>
                <Text style={styles.text}>{exp.start} – {exp.end ?? "Present"} | {exp.location}</Text>
                {exp.description?.map((desc, j) => (
                  <Text key={j} style={styles.listItem}>• {desc}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.educations && cv.educations?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Éducation</Text>
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
            <Text style={styles.subtitle}>Projets</Text>
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
          <Text style={styles.subtitle}>Contact</Text>
          {user?.email && <Text style={styles.text}>{user.email}</Text>}
          {user?.linkedin && <Text style={styles.text}>LinkedIn</Text>}
          {user?.github && <Text style={styles.text}>Portfolio</Text>}
        </View>

        {cv.skills && cv.skills?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Compétences</Text>
            {cv.skills.map((skill, i) => (
              <View key={i}>
                {skill.hardskills && (
                  <>
                    <Text style={styles.text}>Techniques :</Text>
                    <Text style={styles.listItem}>{skill.hardskills}</Text>
                  </>
                )}
                {skill.softskills && (
                  <>
                    <Text style={styles.text}>Soft :</Text>
                    <Text style={styles.listItem}>{skill.softskills}</Text>
                  </>
                )}
                {skill.tools && (
                  <>
                    <Text style={styles.text}>Outils :</Text>
                    <Text style={styles.listItem}>{skill.tools}</Text>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {cv.languages && cv.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Langues</Text>
            {cv.languages.map((lang, i) => (
              <Text key={i} style={styles.text}>{lang.language} - {lang.level}</Text>
            ))}
          </View>
        )}

        {(cv.certifications ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Certifications</Text>
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
}

export default DocTwo;
