// =====================
// ADMIN.JS (Supabase v2)
// =====================

// --- INIT SUPABASE ---
const SUPABASE_URL = "https://xnbbkfuhqegeybubtzdb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYmJrZnVocWVnZXlidWJ0emRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTAyMDgsImV4cCI6MjA4MTUyNjIwOH0.2jyApj2JeIPKkeNetq6OUQLt63xeGvMwc8EEPH17reg";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// --- ELEMENTS ---
const logoutBtn = document.getElementById("logoutBtn");
const projectForm = document.getElementById("projectForm");
const adminProjects = document.getElementById("adminProjects");
const formTitle = document.getElementById("formTitle");

const projectIdInput = document.getElementById("projectId");
const titleInput = document.getElementById("title");
const shortDescInput = document.getElementById("shortDesc");
const longDescInput = document.getElementById("longDesc");
const githubInput = document.getElementById("github");
const demoInput = document.getElementById("demo");
const imageFileInput = document.getElementById("imageFile");

// =====================
// AUTH CHECK
// =====================
async function checkAuth() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Auth check error:", error);
    return;
  }

  if (!session) {
    window.location.href = "login.html";
  } else {
    console.log("Logged in user:", session.user);
    loadProjects();
  }
}
checkAuth();

// =====================
// LOGOUT
// =====================
logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

// =====================
// LOAD PROJECTS
// =====================
async function loadProjects() {
  try {
    const { data: projects, error } = await supabaseClient
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    adminProjects.innerHTML = "";

    if (!projects || projects.length === 0) {
      adminProjects.innerHTML = "<p>No projects found.</p>";
      return;
    }

    projects.forEach(project => {
  const div = document.createElement("div");
  div.className = "admin-project";

  let mediaPreview = "";

  // Prioritize file_url if available (PDF or image)
  if (project.file_url) {
    if (project.file_type === "image") {
      mediaPreview = `<img src="${project.file_url}" alt="${project.title}">`;
    } else if (project.file_type === "pdf") {
      mediaPreview = `
        <div class="pdf-preview">
          <span>📄 PDF</span>
          <a href="${project.file_url}" target="_blank">View PDF</a>
        </div>
      `;
    }
  } 
  // Fallback to project.image
  else if (project.image) {
    mediaPreview = `<img src="${project.image}" alt="${project.title}">`;
  } 
  else {
    mediaPreview = `<div class="no-preview">No file</div>`;
  }

  div.innerHTML = `
    <div class="admin-media">
      ${mediaPreview}
    </div>
    <span class="admin-title">${project.title}</span>
    <button class="edit" data-id="${project.id}">Edit</button>
    <button class="delete" data-id="${project.id}">Delete</button>
  `;

  adminProjects.appendChild(div);
});

  } catch (err) {
    console.error("Failed to load projects:", err);
    adminProjects.innerHTML =
      `<p style="color:red;">Failed to load projects.</p>`;
  }
}

// =====================
// TAG HANDLING
// =====================
function getSelectedTags() {
  return Array.from(
    document.querySelectorAll(".tag-selector input:checked")
  ).map(input => input.value);
}

function resetTagCheckboxes() {
  document
    .querySelectorAll(".tag-selector input")
    .forEach(input => (input.checked = false));

    
}

// FILE PREVIEW FUNCTION
// ------------------------
function renderFilePreview(fileUrl, fileType, title) {
  const previewContainer = document.getElementById("filePreview");
  if (!previewContainer) return;

  if (fileUrl) {
    if (fileType === "image") {
      previewContainer.innerHTML = `<img src="${fileUrl}" alt="${title}" style="max-width:200px;">`;
    } else if (fileType === "pdf") {
      previewContainer.innerHTML = `<div class="pdf-preview">📄 <a href="${fileUrl}" target="_blank">View PDF</a></div>`;
    }
  } else {
    previewContainer.innerHTML = `<p>No file uploaded</p>`;
  }
}



// =====================
// FORM SUBMISSION
// =====================
projectForm.addEventListener("submit", async e => {
  e.preventDefault();

  // -------- COLLECT FORM VALUES --------
  const id = projectIdInput.value;
  const title = titleInput.value.trim();
  const shortDesc = shortDescInput.value.trim();
  const longDesc = longDescInput.value.trim();
  const tags = getSelectedTags();
  const github = githubInput.value.trim();
  const demo = demoInput.value.trim();
  const file = imageFileInput.files[0];

  // These will be saved to DB
  let fileUrl = null;
  let fileType = null;

  // =====================
  // FILE UPLOAD (IMAGE / PDF)
  // =====================
  if (file) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    // Allow only images & PDFs
    if (!isImage && !isPdf) {
      alert("Only image or PDF files are allowed.");
      return;
    }

    fileType = isImage ? "image" : "pdf";

    const filePath = `public/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("projects-storage")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      alert("File upload failed");
      return;
    }

    // Get public URL
    const { data } = supabaseClient.storage
      .from("projects-storage")
      .getPublicUrl(filePath);

    fileUrl = data.publicUrl;
  }

  // =====================
  // INSERT OR UPDATE
  // =====================
  try {
    if (id) {
      // -------- UPDATE EXISTING PROJECT --------
      const updateData = {
        title,
        short_desc: shortDesc,
        long_desc: longDesc,
        tags,
        github,
        demo
      };

      // Only update file if a new one was uploaded
      if (fileUrl) {
        updateData.file_url = fileUrl;
        updateData.file_type = fileType;
      }

      const { error } = await supabaseClient
        .from("projects")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      alert("Project updated successfully!");
    } else {
      // -------- INSERT NEW PROJECT --------
      const { error } = await supabaseClient
        .from("projects")
        .insert([{
          title,
          short_desc: shortDesc,
          long_desc: longDesc,
          tags,
          github,
          demo,
          file_url: fileUrl,
          file_type: fileType

          
        }]);

      
      if (error) throw error;

      alert("Project added successfully!");
    }

    // Show file preview
    renderFilePreview(fileUrl, fileType, title);



    // =====================
    // RESET FORM STATE
    // =====================
    projectForm.reset();
    resetTagCheckboxes();
    projectIdInput.value = "";
    formTitle.textContent = "Add New Project";

    // Clear preview after reset
    renderFilePreview(null, null, "");



    loadProjects();

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

// =====================
// EDIT / DELETE
// =====================
adminProjects.addEventListener("click", async e => {
  const id = e.target.dataset.id;
  if (!id) return;

 // -------- EDIT PROJECT --------
if (e.target.classList.contains("edit")) {
  const { data, error } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  // Populate form fields
  projectIdInput.value = data.id;
  titleInput.value = data.title;
  shortDescInput.value = data.short_desc;
  longDescInput.value = data.long_desc;
  githubInput.value = data.github;
  demoInput.value = data.demo;

  // Restore selected tags
  resetTagCheckboxes();
  (data.tags || []).forEach(tag => {
    const checkbox = document.querySelector(`.tag-selector input[value="${tag}"]`);
    if (checkbox) checkbox.checked = true;
  });

  formTitle.textContent = "Edit Project";

  // -------- SHOW FILE PREVIEW --------
  // Show file preview
    if (data.file_url) {
      renderFilePreview(data.file_url, data.file_type, data.title);
    } else if (data.image) {
      renderFilePreview(data.image, "image", data.title);
    } else {
      renderFilePreview(null, null, "");
    }
  }



  // -------- DELETE PROJECT --------
  if (e.target.classList.contains("delete")) {
    if (!confirm("Delete this project?")) return;

    const { error } = await supabaseClient
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    loadProjects();
  }
});

// =====================
// SITE INFO (ABOUT / CONTACT)
// =====================
// SITE INFO ELEMENTS
// =====================
const siteInfoForm = document.getElementById("siteInfoForm");

const siteAboutInput = document.getElementById("siteAbout");
const siteEmailInput = document.getElementById("siteEmail");
const siteMobileInput = document.getElementById("siteMobile");
const siteGithubInput = document.getElementById("siteGithub");
const siteLocationInput = document.getElementById("siteLocation");
const siteImageInput = document.getElementById("siteImage");


// Load existing site info
async function loadSiteInfo() {
  const { data, error } = await supabaseClient
    .from("site_info")
    .select("*")
    .maybeSingle(); // ✅ avoids 406 + PGRST116

  if (error) {
    console.error("Load site info error:", error);
    return;
  }

  if (!data) return;

  siteAboutInput.value = data.about || "";
  siteEmailInput.value = data.email || "";
  siteMobileInput.value = data.mobile || "";
  siteGithubInput.value = data.github || "";
  siteLocationInput.value = data.location || "";
}

loadSiteInfo();

// Save site info
siteInfoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const about = siteAboutInput.value.trim();
  const email = siteEmailInput.value.trim();
  const mobile = siteMobileInput.value.trim();
  const github = siteGithubInput.value.trim();
  const location = siteLocationInput.value.trim();

  // Upload image if selected
  const file = siteImage.files[0];
  let imageUrl = null;

  if (file) {
    const fileExt = file.name.split(".").pop();
    const filePath = `about_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("site-storage")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error("Image upload error:", uploadError);
      alert("Failed to upload image!");
      return;
    }

    const { data } = supabaseClient.storage
      .from("site-storage")
      .getPublicUrl(filePath);

    imageUrl = data.publicUrl;
  }

  try {
    // Check if a row already exists
    const { data: existingRows, error: fetchError } = await supabaseClient
      .from("site_info")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingRows) {
      // Row exists -> update it
      const { error: updateError } = await supabaseClient
        .from("site_info")
        .update({
          about,
          email,
          mobile,
          github,
          location,
          image: imageUrl ?? existingRows.image
        })
        .eq("id", existingRows.id);

      if (updateError) throw updateError;

      alert("Site info updated!");
    } else {
      // Row does not exist -> insert a new one
      const { error: insertError } = await supabaseClient
        .from("site_info")
        .insert([
          {
            about,
            email,
            mobile,
            github,
            location,
            image: imageUrl ?? null
          }
        ]);

      if (insertError) throw insertError;

      alert("Site info added!");
    }
  } catch (err) {
    console.error("Save site info error:", err);
    alert("Failed to save site info!");
  }
});
