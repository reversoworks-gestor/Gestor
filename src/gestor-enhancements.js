/*
 * Reverso Gestor - extension for the published static baseline.
 * The original React source is unavailable in the repository, so this module
 * augments its existing UI and reuses its Firebase runtime bindings.
 */

const RUNTIME_KEY = "__reversoGestorRuntime";
const STORAGE_BUCKET = "reverso-works.firebasestorage.app";
const WORKSPACE_ID = "reverso-private";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const modalLayers = { standard: 30, nested: 50 };
const objectUrls = new Map();

function runtime() {
  const api = window[RUNTIME_KEY];
  if (!api) throw new Error("O gestor ainda está sendo preparado.");
  return api;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showToast(title, description) {
  const toast = document.createElement("div");
  toast.className = "rw-enhancement-toast";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong>${description ? `<span>${escapeHtml(description)}</span>` : ""}`;
  document.body.append(toast);
  window.setTimeout(() => toast.classList.add("is-visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date).replace(".", "");
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function openModal({ title, subtitle, eyebrow = "OPERAÇÃO / DADOS DO PEDIDO", layer = "standard" }) {
  const backdrop = createElement("div", "modal-backdrop rw-enhancement-backdrop");
  backdrop.dataset.layer = layer;
  backdrop.style.zIndex = String(modalLayers[layer] ?? modalLayers.standard);
  backdrop.setAttribute("role", "presentation");

  const modal = createElement("section", "app-modal rw-enhancement-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", title);

  const top = createElement("div", "modal-top");
  const heading = document.createElement("div");
  heading.append(createElement("span", "eyebrow", eyebrow));
  heading.append(createElement("h2", "", title));
  if (subtitle) heading.append(createElement("p", "", subtitle));
  const closeButton = createElement("button", "icon-button", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar");
  closeButton.title = "Fechar";
  top.append(heading, closeButton);

  const content = createElement("div", "rw-modal-content");
  modal.append(top, content);
  backdrop.append(modal);
  document.body.append(backdrop);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    backdrop.classList.add("is-closing");
    window.setTimeout(() => backdrop.remove(), 180);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  requestAnimationFrame(() => backdrop.classList.add("is-open"));

  return { backdrop, modal, content, close };
}

function appendField(form, labelText, control) {
  const label = document.createElement("label");
  label.append(createElement("span", "", labelText), control);
  form.append(label);
  return control;
}

function input(value = "", options = {}) {
  const control = document.createElement("input");
  control.type = options.type ?? "text";
  control.value = value ?? "";
  if (options.placeholder) control.placeholder = options.placeholder;
  if (options.required) control.required = true;
  if (options.accept) control.accept = options.accept;
  if (options.multiple) control.multiple = true;
  return control;
}

function select(value, entries) {
  const control = document.createElement("select");
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    control.append(option);
  }
  control.value = value ?? "";
  return control;
}

function textarea(value = "") {
  const control = document.createElement("textarea");
  control.value = value ?? "";
  control.rows = 4;
  control.placeholder = "Contexto, observações ou informações relevantes para o pedido.";
  control.className = "rw-notes-field";
  return control;
}

function appendActions(form, { cancelLabel = "Cancelar", submitLabel = "Salvar", onCancel, busy }) {
  const actions = createElement("div", "modal-actions");
  const cancel = createElement("button", "button-secondary", cancelLabel);
  cancel.type = "button";
  cancel.addEventListener("click", onCancel);
  const submit = createElement("button", "button-primary", submitLabel);
  submit.type = "submit";
  actions.append(cancel, submit);
  form.append(actions);
  return {
    setBusy(isBusy, label = submitLabel) {
      submit.disabled = isBusy;
      cancel.disabled = isBusy;
      submit.textContent = isBusy ? "Salvando…" : label;
      if (busy) busy(isBusy);
    },
  };
}

async function listCollection(name) {
  const api = runtime();
  const snapshot = await api.getDocs(api.collection(api.db, "workspaces", api.workspaceId, name));
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function getOrder(orderId) {
  const api = runtime();
  const snapshot = await api.getDoc(api.doc(api.db, "workspaces", api.workspaceId, "orders", orderId));
  if (!snapshot.exists()) throw new Error("Pedido não encontrado.");
  return { id: snapshot.id, ...snapshot.data() };
}

async function createClient(payload) {
  const api = runtime();
  const id = makeId("client");
  const now = new Date().toISOString();
  await api.setDoc(api.doc(api.db, "workspaces", api.workspaceId, "clients", id), {
    ...payload,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return { ...payload, id, createdAt: now, updatedAt: now };
}

async function createOrder(payload) {
  const api = runtime();
  const orderId = makeId("order");
  const pipelineId = makeId("flow");
  const now = new Date().toISOString();
  const order = { ...payload, id: orderId, createdAt: now, updatedAt: now };
  const pipeline = {
    ...payload,
    id: pipelineId,
    orderId,
    title: payload.title || "Pedido sem título",
    stage: payload.stage || "Triagem",
    createdAt: now,
    updatedAt: now,
  };
  await Promise.all([
    api.setDoc(api.doc(api.db, "workspaces", api.workspaceId, "orders", orderId), order),
    api.setDoc(api.doc(api.db, "workspaces", api.workspaceId, "pipeline", pipelineId), pipeline),
  ]);
  return order;
}

async function updateOrder(order, payload) {
  const api = runtime();
  const now = new Date().toISOString();
  const changed = { ...payload, updatedAt: now };
  await api.updateDoc(api.doc(api.db, "workspaces", api.workspaceId, "orders", order.id), changed);

  const flows = await listCollection("pipeline");
  const relatedFlow = flows.find((flow) => flow.orderId === order.id);
  if (relatedFlow) {
    await api.updateDoc(api.doc(api.db, "workspaces", api.workspaceId, "pipeline", relatedFlow.id), changed);
  }
  return { ...order, ...changed };
}

async function getAuthToken() {
  const user = runtime().auth.currentUser;
  if (!user) throw new Error("Faça login novamente antes de enviar imagens.");
  return user.getIdToken();
}

async function encodeLosslessWebP(file) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return null;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { encodeLossless } = await import("../assets/webp-lossless/encoder.js");
  const output = await encodeLossless(imageData);
  return new File([output], `${file.name.replace(/\.[^.]+$/, "") || "imagem"}.webp`, { type: "image/webp" });
}

async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} não é uma imagem válida.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} ultrapassa o limite de 25 MB por imagem.`);
  const lossless = await encodeLosslessWebP(file);
  // Preserve the supplied original whenever lossless WebP would not reduce storage.
  return lossless && lossless.size < file.size ? lossless : file;
}

async function uploadImage(orderId, file) {
  const prepared = await prepareImage(file);
  const api = runtime();
  const token = await getAuthToken();
  const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "imagem";
  const storagePath = `workspaces/${api.workspaceId}/orders/${orderId}/${crypto.randomUUID()}-${safeName}`;
  const endpoint = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(storagePath)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": prepared.type || "application/octet-stream",
    },
    body: prepared,
  });
  if (!response.ok) throw new Error(`Falha no envio da imagem (${response.status}).`);
  return {
    storagePath,
    filename: prepared.name,
    originalFilename: file.name,
    contentType: prepared.type || file.type,
    size: prepared.size,
    optimized: prepared !== file,
  };
}

async function uploadImages(orderId, files, onProgress) {
  const images = [];
  for (let index = 0; index < files.length; index += 1) {
    onProgress?.(index + 1, files.length, files[index].name);
    images.push(await uploadImage(orderId, files[index]));
  }
  return images;
}

async function loadSecureImage(image) {
  if (objectUrls.has(image.storagePath)) return objectUrls.get(image.storagePath);
  const token = await getAuthToken();
  const endpoint = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(image.storagePath)}?alt=media`;
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Não foi possível carregar esta imagem.");
  const objectUrl = URL.createObjectURL(await response.blob());
  objectUrls.set(image.storagePath, objectUrl);
  return objectUrl;
}

function openClientModal({ onSaved, layer = "nested" } = {}) {
  const view = openModal({
    title: "Novo cliente",
    subtitle: "Registre o contato sem sair do pedido.",
    eyebrow: "OPERAÇÃO / NOVO CLIENTE",
    layer,
  });
  const form = createElement("form", "modal-form");
  const name = appendField(form, "Nome", input("", { placeholder: "Nome do cliente", required: true }));
  const company = appendField(form, "Empresa / oficina", input("", { placeholder: "Opcional" }));
  const group = createElement("div", "form-two");
  const emailLabel = document.createElement("label");
  const email = input("", { type: "email", placeholder: "contato@email.com" });
  emailLabel.append(createElement("span", "", "E-mail"), email);
  const phoneLabel = document.createElement("label");
  const phone = input("", { placeholder: "(000) 000-0000" });
  phoneLabel.append(createElement("span", "", "Telefone"), phone);
  group.append(emailLabel, phoneLabel);
  form.append(group);
  const actions = appendActions(form, { cancelLabel: "Cancelar", submitLabel: "Cadastrar", onCancel: view.close });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!name.value.trim()) return name.focus();
    actions.setBusy(true, "Cadastrar");
    try {
      const client = await createClient({ name: name.value.trim(), company: company.value.trim(), email: email.value.trim(), phone: phone.value.trim() });
      onSaved?.(client);
      view.close();
      showToast("Cliente cadastrado", "O cliente já está disponível para este pedido.");
    } catch (error) {
      console.error(error);
      showToast("Não foi possível cadastrar o cliente", error.message || "Verifique a conexão e tente novamente.");
      actions.setBusy(false, "Cadastrar");
    }
  });
  view.content.append(form);
  name.focus();
}

function createOrderEditor({ order = null, clients, onSaved }) {
  const isEditing = Boolean(order);
  const view = openModal({
    title: isEditing ? "Editar pedido" : "Novo pedido",
    subtitle: isEditing ? "Atualize os dados do dossiê do trabalho." : "Abra o dossiê e direcione o trabalho para a operação.",
    eyebrow: isEditing ? "OPERAÇÃO / EDITAR REGISTRO" : "OPERAÇÃO / NOVO REGISTRO",
  });
  const form = createElement("form", "modal-form");
  const title = appendField(form, "Nome do projeto", input(order?.title, { placeholder: "Ex.: Suporte de painel — Fox 1989", required: true }));
  const clientGroup = createElement("div", "form-two");
  const clientLabel = document.createElement("label");
  const clientSelect = select(order?.clientId ?? "", [
    { value: "", label: "Sem cliente por enquanto" },
    ...clients.map((client) => ({ value: client.id, label: client.name })),
    { value: "__new_client__", label: "+ Criar novo cliente" },
  ]);
  clientLabel.append(createElement("span", "", "Cliente"), clientSelect);
  const lineLabel = document.createElement("label");
  const line = select(order?.line ?? "Works", [{ value: "Works", label: "Works" }, { value: "Studio", label: "Studio" }]);
  lineLabel.append(createElement("span", "", "Linha"), line);
  clientGroup.append(clientLabel, lineLabel);
  form.append(clientGroup);

  let selectedClient = clients.find((client) => client.id === clientSelect.value) ?? null;
  clientSelect.addEventListener("change", () => {
    if (clientSelect.value !== "__new_client__") {
      selectedClient = clients.find((client) => client.id === clientSelect.value) ?? null;
      return;
    }
    openClientModal({
      onSaved(client) {
        clients.push(client);
        const option = document.createElement("option");
        option.value = client.id;
        option.textContent = client.name;
        clientSelect.insertBefore(option, clientSelect.lastElementChild);
        clientSelect.value = client.id;
        selectedClient = client;
      },
    });
  });

  const productionGroup = createElement("div", "form-two");
  const materialLabel = document.createElement("label");
  const material = select(order?.material ?? "PETG", ["PETG", "ASA", "Nylon / CF", "TPU"].map((value) => ({ value, label: value })));
  materialLabel.append(createElement("span", "", "Material inicial"), material);
  const dueLabel = document.createElement("label");
  const dueDate = input(order?.dueDate, { type: "date" });
  dueLabel.append(createElement("span", "", "Entrega"), dueDate);
  productionGroup.append(materialLabel, dueLabel);
  form.append(productionGroup);

  const metadataGroup = createElement("div", "form-two");
  const partLabel = document.createElement("label");
  const partCode = input(order?.partCode, { placeholder: "RW-XX-001" });
  partLabel.append(createElement("span", "", "Código da peça"), partCode);
  const priorityLabel = document.createElement("label");
  const priority = select(order?.priority ?? "normal", [{ value: "normal", label: "Normal" }, { value: "high", label: "Alta" }, { value: "low", label: "Baixa" }]);
  priorityLabel.append(createElement("span", "", "Prioridade"), priority);
  metadataGroup.append(partLabel, priorityLabel);
  form.append(metadataGroup);

  const revisionStage = createElement("div", "form-two");
  const revisionLabel = document.createElement("label");
  const revision = input(order?.revision ?? "R01", { placeholder: "R01" });
  revisionLabel.append(createElement("span", "", "Revisão"), revision);
  const stageLabel = document.createElement("label");
  const stage = select(order?.stage ?? "Triagem", ["Triagem", "CAD / engenharia", "Imprimindo", "Pós-processo", "Qualidade", "Pronto para entrega"].map((value) => ({ value, label: value })));
  stageLabel.append(createElement("span", "", "Etapa"), stage);
  revisionStage.append(revisionLabel, stageLabel);
  form.append(revisionStage);

  appendField(form, "Notas", textarea(order?.notes));
  const upload = input("", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true });
  upload.className = "rw-image-input";
  const uploadLabel = document.createElement("label");
  uploadLabel.className = "rw-image-upload";
  uploadLabel.append(createElement("span", "", isEditing ? "Adicionar imagens" : "Imagens do pedido"), upload, createElement("small", "", "JPEG, PNG ou WebP. O envio preserva a qualidade; WebP sem perda só é usado quando reduz o tamanho."));
  form.append(uploadLabel);

  const actions = appendActions(form, { cancelLabel: "Cancelar", submitLabel: isEditing ? "Salvar alterações" : "Criar pedido", onCancel: view.close });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!title.value.trim()) return title.focus();
    actions.setBusy(true, isEditing ? "Salvar alterações" : "Criar pedido");
    try {
      const payload = {
        title: title.value.trim(),
        clientId: selectedClient?.id ?? "",
        clientName: selectedClient?.name ?? "Cliente não atribuído",
        line: line.value,
        stage: stage.value,
        priority: priority.value,
        dueDate: dueDate.value,
        material: material.value,
        partCode: partCode.value.trim(),
        revision: revision.value.trim() || "R01",
        notes: textareaValue(form),
      };
      let result;
      if (isEditing) {
        const newImages = upload.files.length ? await uploadImages(order.id, Array.from(upload.files), (current, total) => actions.setBusy(true, `Enviando imagem ${current}/${total}`)) : [];
        result = await updateOrder(order, { ...payload, images: [...(order.images ?? []), ...newImages] });
      } else {
        const code = `RVS-${String(Date.now()).slice(-3)}`;
        result = await createOrder({ ...payload, code, images: [] });
        const newImages = upload.files.length ? await uploadImages(result.id, Array.from(upload.files), (current, total) => actions.setBusy(true, `Enviando imagem ${current}/${total}`)) : [];
        if (newImages.length) result = await updateOrder(result, { images: newImages });
      }
      onSaved?.(result);
      view.close();
      showToast(isEditing ? "Pedido atualizado" : "Pedido criado", isEditing ? "As informações do dossiê foram atualizadas." : "O dossiê foi adicionado ao quadro de produção.");
    } catch (error) {
      console.error(error);
      showToast(isEditing ? "Não foi possível atualizar o pedido" : "Não foi possível criar o pedido", error.message || "Verifique a conexão e as regras do Firebase.");
      actions.setBusy(false, isEditing ? "Salvar alterações" : "Criar pedido");
    }
  });
  view.content.append(form);
  title.focus();
}

function textareaValue(form) {
  return form.querySelector("textarea")?.value.trim() ?? "";
}

async function openOrderEditor(order) {
  try {
    const clients = await listCollection("clients");
    createOrderEditor({ order, clients, onSaved: openOrderDetail });
  } catch (error) {
    console.error(error);
    showToast("Não foi possível abrir o pedido", error.message || "Tente novamente.");
  }
}

function detailValue(label, value) {
  const item = createElement("div", "rw-detail-item");
  item.append(createElement("span", "", label), createElement("strong", "", value || "—"));
  return item;
}

async function openOrderDetail(orderOrId) {
  let view;
  try {
    const order = typeof orderOrId === "string" ? await getOrder(orderOrId) : orderOrId;
    view = openModal({ title: order.title || "Pedido sem título", subtitle: `${order.code || "SEM CÓDIGO"} · Dossiê operacional`, eyebrow: "OPERAÇÃO / DETALHES DO PEDIDO" });
    const details = createElement("div", "rw-detail-grid");
    details.append(
      detailValue("Cliente", order.clientName),
      detailValue("Linha", order.line),
      detailValue("Etapa", order.stage),
      detailValue("Entrega", formatDate(order.dueDate)),
      detailValue("Material", order.material),
      detailValue("Código da peça", order.partCode),
      detailValue("Revisão", order.revision),
      detailValue("Prioridade", { high: "Alta", normal: "Normal", low: "Baixa" }[order.priority] || order.priority),
    );
    view.content.append(details);

    const notes = createElement("section", "rw-detail-section");
    notes.append(createElement("span", "eyebrow", "NOTAS"), createElement("p", "rw-detail-notes", order.notes || "Nenhuma nota registrada para este pedido."));
    view.content.append(notes);

    const photos = createElement("section", "rw-detail-section");
    photos.append(createElement("span", "eyebrow", "IMAGENS DO PEDIDO"));
    const grid = createElement("div", "rw-image-grid");
    const images = Array.isArray(order.images) ? order.images : [];
    if (!images.length) grid.append(createElement("p", "rw-detail-notes", "Nenhuma imagem anexada a este pedido."));
    photos.append(grid);
    view.content.append(photos);

    for (const image of images) {
      const figure = createElement("figure", "rw-image-item");
      const picture = createElement("img", "rw-image-preview");
      picture.alt = image.originalFilename || image.filename || "Imagem do pedido";
      const caption = createElement("figcaption", "", image.originalFilename || image.filename || "Imagem");
      figure.append(picture, caption);
      grid.append(figure);
      loadSecureImage(image).then((url) => { picture.src = url; }).catch(() => {
        figure.classList.add("has-error");
        caption.textContent = `${caption.textContent} — indisponível`;
      });
    }

    const actions = createElement("div", "modal-actions");
    const close = createElement("button", "button-secondary", "Fechar");
    close.type = "button";
    close.addEventListener("click", view.close);
    const edit = createElement("button", "button-primary", "Editar pedido");
    edit.type = "button";
    edit.addEventListener("click", () => { view.close(); openOrderEditor(order); });
    actions.append(close, edit);
    view.content.append(actions);
  } catch (error) {
    console.error(error);
    view?.close();
    showToast("Não foi possível abrir o pedido", error.message || "Tente novamente.");
  }
}

function findValueByLabel(form, labelText) {
  return Array.from(form.querySelectorAll("label")).find((label) => label.querySelector("span")?.textContent.trim() === labelText)?.querySelector("input, select, textarea");
}

function enhanceOriginalOrderModal(backdrop) {
  const title = backdrop.querySelector(".modal-top h2")?.textContent?.trim();
  if (title !== "Novo pedido" || backdrop.dataset.rwEnhanced === "true") return;
  const form = backdrop.querySelector("form.modal-form");
  const clientSelect = findValueByLabel(form, "Cliente");
  if (!form || !clientSelect) return;
  backdrop.dataset.rwEnhanced = "true";

  const newClientOption = document.createElement("option");
  newClientOption.value = "__new_client__";
  newClientOption.textContent = "+ Criar novo cliente";
  clientSelect.append(newClientOption);
  let selectedClient = null;
  clientSelect.addEventListener("change", () => {
    if (clientSelect.value !== "__new_client__") {
      selectedClient = clientSelect.options[clientSelect.selectedIndex];
      return;
    }
    openClientModal({
      onSaved(client) {
        const option = document.createElement("option");
        option.value = client.id;
        option.textContent = client.name;
        clientSelect.insertBefore(option, newClientOption);
        clientSelect.value = client.id;
        clientSelect.dispatchEvent(new Event("change", { bubbles: true }));
        selectedClient = option;
      },
    });
  });

  const notes = textarea("");
  appendField(form, "Notas", notes).classList.add("rw-added-field");
  const fileInput = input("", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true });
  fileInput.className = "rw-image-input";
  const uploadLabel = document.createElement("label");
  uploadLabel.className = "rw-image-upload rw-added-field";
  uploadLabel.append(createElement("span", "", "Imagens do pedido"), fileInput, createElement("small", "", "JPEG, PNG ou WebP. O envio preserva a qualidade; WebP sem perda só é usado quando reduz o tamanho."));
  form.insertBefore(uploadLabel, form.querySelector(".modal-actions"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const titleInput = findValueByLabel(form, "Nome do projeto");
    if (!titleInput?.value.trim()) return titleInput?.focus();
    const submit = form.querySelector('button[type="submit"]');
    const cancel = form.querySelector(".button-secondary");
    submit.disabled = true;
    cancel.disabled = true;
    try {
      const clientId = clientSelect.value;
      const option = clientSelect.options[clientSelect.selectedIndex];
      const payload = {
        title: titleInput.value.trim(),
        clientId: clientId === "__new_client__" ? "" : clientId,
        clientName: clientId && clientId !== "__new_client__" ? option?.textContent || "Cliente não atribuído" : "Cliente não atribuído",
        line: findValueByLabel(form, "Linha")?.value || "Works",
        stage: "Triagem",
        priority: findValueByLabel(form, "Prioridade")?.value || "normal",
        dueDate: findValueByLabel(form, "Entrega")?.value || "",
        material: findValueByLabel(form, "Material inicial")?.value || "PETG",
        partCode: findValueByLabel(form, "Código da peça")?.value.trim() || "",
        revision: "R01",
        notes: notes.value.trim(),
        code: `RVS-${String(Date.now()).slice(-3)}`,
        images: [],
      };
      submit.textContent = "Criando…";
      let order = await createOrder(payload);
      if (fileInput.files.length) {
        const images = await uploadImages(order.id, Array.from(fileInput.files), (current, total) => { submit.textContent = `Enviando imagem ${current}/${total}`; });
        order = await updateOrder(order, { images });
      }
      cancel.click();
      showToast("Pedido criado", "O dossiê foi adicionado ao quadro de produção.");
      window.setTimeout(() => openOrderDetail(order), 150);
    } catch (error) {
      console.error(error);
      showToast("Não foi possível criar o pedido", error.message || "Verifique a conexão e as regras do Firebase.");
      submit.disabled = false;
      cancel.disabled = false;
      submit.textContent = "Criar pedido";
    }
  }, true);
}

async function resolveOrderFromRow(row) {
  const code = row.querySelector(".project-code")?.textContent.trim();
  if (!code) throw new Error("Código do pedido não encontrado.");
  try {
    const orders = await listCollection("orders");
    const order = orders.find((candidate) => candidate.code === code);
    if (!order) throw new Error("Pedido não encontrado.");
    return order;
  } catch (error) {
    // Preview mode has no signed Firebase session. Keep the dossiê view usable
    // with the published demonstration data while production always reads Firestore.
    if (!new URLSearchParams(window.location.search).has("preview")) throw error;
    const values = row.querySelectorAll("span, strong, small");
    return {
      id: `preview_${code}`,
      code,
      title: row.querySelector("strong")?.textContent.trim() || "Pedido sem título",
      clientName: row.querySelector(".table-client")?.textContent.trim() || "Cliente não atribuído",
      line: Array.from(values).find((element) => /^(Works|Studio)$/.test(element.textContent.trim()))?.textContent.trim() || "Works",
      stage: row.querySelector(".table-stage")?.textContent.trim() || "Triagem",
      dueDate: row.querySelector(".table-date")?.textContent.trim() || "",
      partCode: row.querySelector("small")?.textContent.split("·")[0]?.trim() || "",
      revision: row.querySelector("small")?.textContent.split("·")[1]?.trim() || "R01",
      material: "—",
      priority: "normal",
      notes: "",
      images: [],
    };
  }
}

function enhanceOrderRows(root = document) {
  for (const row of root.querySelectorAll(".order-table-row:not([data-rw-enhanced-row])")) {
    row.dataset.rwEnhancedRow = "true";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", "Abrir detalhes do pedido");
    const open = async () => {
      try { openOrderDetail(await resolveOrderFromRow(row)); }
      catch (error) { console.error(error); showToast("Não foi possível abrir o pedido", error.message || "Tente novamente."); }
    };
    row.addEventListener("click", (event) => {
      if (event.target.closest(".table-client")) return;
      open();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  }
}

function observeInterface() {
  const observer = new MutationObserver(() => {
    document.querySelectorAll(".modal-backdrop").forEach(enhanceOriginalOrderModal);
    enhanceOrderRows();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  enhanceOrderRows();
}

function interceptNewOrderButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button || button.dataset.rwCustomNewOrder === "true") return;
    const label = button.textContent.replace(/\s+/g, " ").trim();
    if (!/^(Novo pedido|Criar pedido|Abrir novo pedido)$/i.test(label)) return;
    // Existing entry points retain their layout. The published dialog is enhanced
    // in place by the observer, avoiding any visual replacement of this flow.
  }, true);
}

function boot() {
  if (!window[RUNTIME_KEY]) {
    window.setTimeout(boot, 30);
    return;
  }
  observeInterface();
  interceptNewOrderButtons();
}

boot();
