const data = window.QUIZ_DATA;
const questions = data.questions;
const storageKey = "objective-quiz-progress-v1";

const typeNames = {
  single: "单选题",
  multiple: "多选题",
  blank: "填空题",
  judge: "判断题",
};

const els = {
  sourceInfo: document.querySelector("#sourceInfo"),
  totalCount: document.querySelector("#totalCount"),
  doneCount: document.querySelector("#doneCount"),
  accuracy: document.querySelector("#accuracy"),
  modeSelect: document.querySelector("#modeSelect"),
  chapterSelect: document.querySelector("#chapterSelect"),
  typeSelect: document.querySelector("#typeSelect"),
  searchInput: document.querySelector("#searchInput"),
  resetProgress: document.querySelector("#resetProgress"),
  shuffleNow: document.querySelector("#shuffleNow"),
  typeBadge: document.querySelector("#typeBadge"),
  chapterBadge: document.querySelector("#chapterBadge"),
  positionText: document.querySelector("#positionText"),
  progressBar: document.querySelector("#progressBar"),
  questionNumber: document.querySelector("#questionNumber"),
  favoriteBtn: document.querySelector("#favoriteBtn"),
  prompt: document.querySelector("#prompt"),
  answerArea: document.querySelector("#answerArea"),
  feedback: document.querySelector("#feedback"),
  prevBtn: document.querySelector("#prevBtn"),
  showAnswerBtn: document.querySelector("#showAnswerBtn"),
  submitBtn: document.querySelector("#submitBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  questionList: document.querySelector("#questionList"),
  listCount: document.querySelector("#listCount"),
};

let progress = loadProgress();
let filtered = [];
let currentIndex = 0;
let selected = [];
let revealed = false;
let randomSeed = Date.now();

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return {
      answered: saved?.answered || {},
      wrong: saved?.wrong || {},
      favorites: saved?.favorites || {},
    };
  } catch {
    return { answered: {}, wrong: {}, favorites: {} };
  }
}

function saveProgress() {
  localStorage.setItem(storageKey, JSON.stringify(progress));
}

function normalize(text) {
  return String(text).replace(/\s+/g, "").replace(/[，,;；、]/g, "").trim();
}

function sameAnswers(a, b) {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

function seededShuffle(list) {
  const result = [...list];
  let seed = randomSeed % 2147483647;
  for (let index = result.length - 1; index > 0; index -= 1) {
    seed = (seed * 48271) % 2147483647;
    const swapIndex = seed % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildChapterSelect() {
  els.chapterSelect.innerHTML = `<option value="all">全部章节</option>`;
  data.chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = chapter;
    els.chapterSelect.append(option);
  });
}

function applyFilters() {
  const mode = els.modeSelect.value;
  const chapter = els.chapterSelect.value;
  const type = els.typeSelect.value;
  const query = normalize(els.searchInput.value);

  filtered = questions.filter((question) => {
    if (chapter !== "all" && question.chapter !== chapter) return false;
    if (type !== "all" && question.type !== type) return false;
    if (mode === "wrong" && !progress.wrong[question.id]) return false;
    if (mode === "fav" && !progress.favorites[question.id]) return false;
    if (query) {
      const haystack = normalize(
        `${question.prompt} ${question.text} ${question.answer.join(" ")} ${
          question.options?.map((option) => option.text).join(" ") || ""
        }`,
      );
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  if (mode === "random") filtered = seededShuffle(filtered);
  currentIndex = Math.min(currentIndex, Math.max(filtered.length - 1, 0));
  selected = [];
  revealed = false;
  render();
}

function currentQuestion() {
  return filtered[currentIndex];
}

function renderStats() {
  const answered = Object.values(progress.answered);
  const correct = answered.filter((item) => item.correct).length;
  els.sourceInfo.textContent = data.source;
  els.totalCount.textContent = data.total;
  els.doneCount.textContent = answered.length;
  els.accuracy.textContent = answered.length ? `${Math.round((correct / answered.length) * 100)}%` : "0%";
}

function answerText(question) {
  if (question.type === "blank") return question.answer.join("、");
  return question.answer
    .map((key) => {
      const option = question.options.find((item) => item.key === key);
      return option ? `${key}. ${option.text}` : key;
    })
    .join("；");
}

function renderEmpty() {
  els.typeBadge.textContent = "无题目";
  els.chapterBadge.textContent = "";
  els.positionText.textContent = "0 / 0";
  els.progressBar.style.width = "0%";
  els.questionNumber.textContent = "没有匹配题目";
  els.prompt.textContent = "";
  els.answerArea.innerHTML = `<div class="empty-state">当前筛选条件下没有题目。</div>`;
  els.feedback.hidden = true;
  els.submitBtn.disabled = true;
  els.showAnswerBtn.disabled = true;
  els.prevBtn.disabled = true;
  els.nextBtn.disabled = true;
  els.favoriteBtn.disabled = true;
  renderQuestionList();
}

function render() {
  renderStats();
  if (!filtered.length) {
    renderEmpty();
    return;
  }

  const question = currentQuestion();
  const saved = progress.answered[question.id];
  selected = saved?.chosen ? [...saved.chosen] : selected;
  revealed = Boolean(saved);

  els.typeBadge.textContent = typeNames[question.type];
  els.chapterBadge.textContent = question.chapter;
  els.positionText.textContent = `${currentIndex + 1} / ${filtered.length}`;
  els.progressBar.style.width = `${((currentIndex + 1) / filtered.length) * 100}%`;
  els.questionNumber.textContent = `第 ${question.index} 题 · 本章 ${question.number} 题`;
  els.prompt.textContent = question.prompt;
  els.favoriteBtn.disabled = false;
  els.favoriteBtn.classList.toggle("active", Boolean(progress.favorites[question.id]));
  els.favoriteBtn.textContent = progress.favorites[question.id] ? "★" : "☆";
  els.prevBtn.disabled = currentIndex === 0;
  els.nextBtn.disabled = currentIndex === filtered.length - 1;
  els.submitBtn.disabled = false;
  els.showAnswerBtn.disabled = false;

  renderAnswerArea(question, saved);
  renderFeedback(question, saved);
  renderQuestionList();
}

function renderAnswerArea(question, saved) {
  els.answerArea.innerHTML = "";

  if (question.type === "blank") {
    const input = document.createElement("input");
    input.className = "blank-input";
    input.placeholder = "输入答案，多个空可用顿号隔开";
    input.value = saved?.chosen?.[0] || "";
    input.disabled = Boolean(saved);
    input.addEventListener("input", () => {
      selected = [input.value];
    });
    els.answerArea.append(input);
    selected = saved?.chosen || selected;
    return;
  }

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.innerHTML = `<span class="option-key">${option.key}</span><span>${option.text}</span>`;
    button.disabled = Boolean(saved);

    if (selected.includes(option.key)) button.classList.add("selected");
    if (saved || revealed) {
      if (question.answer.includes(option.key)) button.classList.add("correct");
      if (selected.includes(option.key) && !question.answer.includes(option.key)) {
        button.classList.add("wrong");
      }
    }

    button.addEventListener("click", () => {
      if (question.type === "multiple") {
        selected = selected.includes(option.key)
          ? selected.filter((key) => key !== option.key)
          : [...selected, option.key];
      } else {
        selected = [option.key];
      }
      renderAnswerArea(question, null);
    });
    els.answerArea.append(button);
  });
}

function renderFeedback(question, saved) {
  if (!saved && !revealed) {
    els.feedback.hidden = true;
    return;
  }
  const isCorrect = saved?.correct;
  els.feedback.hidden = false;
  els.feedback.className = `feedback ${isCorrect ? "good" : "bad"}`;
  els.feedback.textContent = `${saved ? (isCorrect ? "答对了。" : "答错了。") : "参考答案："} ${
    saved ? `答案：${answerText(question)}` : answerText(question)
  }`;
}

function checkBlank(question) {
  const value = normalize(selected[0] || "");
  return question.answer.every((answer) => value.includes(normalize(answer)));
}

function submitAnswer(forceReveal = false) {
  const question = currentQuestion();
  if (!question) return;

  if (forceReveal) {
    revealed = true;
    renderAnswerArea(question, null);
    renderFeedback(question, null);
    return;
  }

  if (!selected.length || selected.every((item) => !String(item).trim())) {
    els.feedback.hidden = false;
    els.feedback.className = "feedback bad";
    els.feedback.textContent = "先选一个答案再提交。";
    return;
  }

  const correct = question.type === "blank" ? checkBlank(question) : sameAnswers(selected, question.answer);
  progress.answered[question.id] = { correct, chosen: [...selected], time: Date.now() };
  if (correct) {
    delete progress.wrong[question.id];
  } else {
    progress.wrong[question.id] = true;
  }
  saveProgress();
  render();
}

function renderQuestionList() {
  els.listCount.textContent = `${filtered.length} 题`;
  els.questionList.innerHTML = "";
  filtered.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-chip";
    button.textContent = index + 1;
    if (index === currentIndex) button.classList.add("current");
    if (progress.answered[question.id]?.correct) button.classList.add("done");
    if (progress.wrong[question.id]) button.classList.add("missed");
    button.addEventListener("click", () => goTo(index));
    els.questionList.append(button);
  });
}

function goTo(index) {
  currentIndex = Math.max(0, Math.min(index, filtered.length - 1));
  selected = [];
  revealed = false;
  render();
}

function resetProgress() {
  const ok = confirm("确定清空刷题记录、错题和收藏吗？");
  if (!ok) return;
  progress = { answered: {}, wrong: {}, favorites: {} };
  saveProgress();
  selected = [];
  revealed = false;
  applyFilters();
}

function bindEvents() {
  [els.modeSelect, els.chapterSelect, els.typeSelect].forEach((control) => {
    control.addEventListener("change", () => {
      currentIndex = 0;
      applyFilters();
    });
  });
  els.searchInput.addEventListener("input", () => {
    currentIndex = 0;
    applyFilters();
  });
  els.prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
  els.nextBtn.addEventListener("click", () => goTo(currentIndex + 1));
  els.submitBtn.addEventListener("click", () => submitAnswer(false));
  els.showAnswerBtn.addEventListener("click", () => submitAnswer(true));
  els.favoriteBtn.addEventListener("click", () => {
    const question = currentQuestion();
    if (!question) return;
    if (progress.favorites[question.id]) {
      delete progress.favorites[question.id];
    } else {
      progress.favorites[question.id] = true;
    }
    saveProgress();
    render();
  });
  els.resetProgress.addEventListener("click", resetProgress);
  els.shuffleNow.addEventListener("click", () => {
    randomSeed = Date.now();
    els.modeSelect.value = "random";
    currentIndex = 0;
    applyFilters();
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select")) return;
    if (event.key === "ArrowLeft") goTo(currentIndex - 1);
    if (event.key === "ArrowRight") goTo(currentIndex + 1);
    if (event.key === "Enter") submitAnswer(false);
  });
}

buildChapterSelect();
bindEvents();
applyFilters();
