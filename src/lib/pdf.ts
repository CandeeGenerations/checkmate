import {jsPDF} from 'jspdf'

import type {Category, PeriodItem, PeriodView} from './api'
import {groupBySection} from './categories'
import type {Frequency} from './date'
import {WEEKDAY_SHORT, formatDateLabel, formatDayLabel} from './date'

const TITLE_FONT = 18
const SECTION_FONT = 11
const ITEM_FONT = 11
const CATEGORY_HEADING_FONT = 12
const CHECKBOX_SIZE = 12
const ROW_HEIGHT = 22
const CATEGORY_HEADING_GAP_ABOVE = 8
const CATEGORY_HEADING_GAP_BELOW = 4
const COL_GAP = 8

const FREQUENCY_TITLE: Record<Frequency, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  quarterly: 'This quarter',
}

export function exportPeriodPdf(view: PeriodView, categories: Category[]): void {
  const remaining = view.items.filter((it) => !it.completed)
  if (view.frequency === 'weekly') {
    renderWeeklyKanban(view, remaining, categories)
  } else {
    renderChecklist(view, remaining, categories)
  }
}

// ---------------- Portrait checklist (daily, monthly, quarterly) ----------------

function renderChecklist(view: PeriodView, items: PeriodItem[], categories: Category[]): void {
  const doc = new jsPDF({orientation: 'portrait', unit: 'pt', format: 'letter'})
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const contentLeft = margin
  const contentRight = pageWidth - margin
  const contentBottom = pageHeight - margin

  // Header.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TITLE_FONT)
  doc.text(`${FREQUENCY_TITLE[view.frequency]} — Checkmate`, contentLeft, margin + TITLE_FONT)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(SECTION_FONT)
  doc.setTextColor(120, 120, 120)
  doc.text(rangeLabel(view), contentLeft, margin + TITLE_FONT + 16)
  doc.setTextColor(0, 0, 0)

  let y = margin + TITLE_FONT + 36

  if (items.length === 0) {
    doc.setFontSize(ITEM_FONT)
    doc.setTextColor(140, 140, 140)
    doc.text('Nothing left to do — go enjoy yourself.', contentLeft, y)
    doc.save(filename(view))
    return
  }

  const sections = groupBySection(items, categories)
  // If the only section is Uncategorized, drop the heading to preserve the pre-Category look.
  const showHeadings = sections.some((s) => s.category != null)

  doc.setFontSize(ITEM_FONT)
  for (const section of sections) {
    if (showHeadings) {
      if (y + CATEGORY_HEADING_FONT + CATEGORY_HEADING_GAP_ABOVE > contentBottom) {
        doc.addPage()
        y = margin
      }
      y += CATEGORY_HEADING_GAP_ABOVE
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(CATEGORY_HEADING_FONT)
      doc.setTextColor(60, 60, 60)
      const heading = section.category
        ? `${section.category.icon ? `${section.category.icon}  ` : ''}${section.category.name}`
        : 'Uncategorized'
      doc.text(heading, contentLeft, y)
      // Thin underline rule across the content width.
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(contentLeft, y + 4, contentRight, y + 4)
      y += CATEGORY_HEADING_FONT + CATEGORY_HEADING_GAP_BELOW
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(ITEM_FONT)
      doc.setTextColor(0, 0, 0)
    }
    for (const item of section.items) {
      if (y + ROW_HEIGHT > contentBottom) {
        doc.addPage()
        y = margin
      }
      drawCheckbox(doc, contentLeft, y - CHECKBOX_SIZE + 2)
      doc.setTextColor(0, 0, 0)
      doc.text(item.title, contentLeft + CHECKBOX_SIZE + 10, y)
      const meta = checklistMeta(view.frequency, item)
      if (meta) {
        doc.setTextColor(140, 140, 140)
        doc.text(meta, contentRight, y, {align: 'right'})
      }
      y += ROW_HEIGHT
    }
  }

  doc.save(filename(view))
}

function checklistMeta(frequency: Frequency, item: PeriodItem): string {
  if (frequency === 'daily') {
    if (item.frequency === 'daily') return ''
    return labelForBaseFrequency(item)
  }
  if (frequency === 'monthly') {
    return item.dayOfMonth == null ? 'Any day' : `Day ${item.dayOfMonth}`
  }
  if (frequency === 'quarterly') {
    if (item.monthOfQuarter == null || item.dayOfMonth == null) return 'Any time'
    const m = ['1st', '2nd', '3rd'][item.monthOfQuarter - 1]
    return `${m} mo · day ${item.dayOfMonth}`
  }
  return ''
}

function labelForBaseFrequency(item: PeriodItem): string {
  switch (item.frequency) {
    case 'weekly':
      return 'Weekly'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    default:
      return ''
  }
}

// ---------------- Landscape weekly kanban (single page) ----------------

function renderWeeklyKanban(view: PeriodView, items: PeriodItem[], categories: Category[]): void {
  const doc = new jsPDF({orientation: 'landscape', unit: 'pt', format: 'letter'})
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 32

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TITLE_FONT)
  doc.text('This week — Checkmate', margin, margin + TITLE_FONT)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(SECTION_FONT)
  doc.setTextColor(120, 120, 120)
  doc.text(rangeLabel(view), margin, margin + TITLE_FONT + 14)
  doc.setTextColor(0, 0, 0)

  const gridTop = margin + TITLE_FONT + 32
  const gridBottom = pageHeight - margin
  const gridLeft = margin
  const gridRight = pageWidth - margin
  const gridWidth = gridRight - gridLeft
  const numCols = 8
  const colWidth = (gridWidth - COL_GAP * (numCols - 1)) / numCols
  const headerHeight = 24
  const padding = 6

  const columns = groupForKanban(items)
  const headers = ['Unassigned', ...WEEKDAY_SHORT.map((d) => d.full)]
  const showSubHeadings = items.some((it) => it.categoryId != null)

  for (let i = 0; i < numCols; i++) {
    const x = gridLeft + i * (colWidth + COL_GAP)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.5)
    doc.rect(x, gridTop, colWidth, gridBottom - gridTop, 'S')
    doc.setFillColor(245, 245, 245)
    doc.rect(x, gridTop, colWidth, headerHeight, 'F')
    doc.setDrawColor(180, 180, 180)
    doc.line(x, gridTop + headerHeight, x + colWidth, gridTop + headerHeight)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(SECTION_FONT)
    doc.setTextColor(80, 80, 80)
    doc.text(headers[i], x + colWidth / 2, gridTop + headerHeight - 8, {align: 'center'})

    const colItems = i === 0 ? columns.unassigned : columns.byDay[i - 1]
    const fontSize = ITEM_FONT - 1
    const lineHeight = fontSize + 4
    const textX = x + padding + CHECKBOX_SIZE + 4
    const textMaxWidth = colWidth - padding * 2 - CHECKBOX_SIZE - 4
    let itemY = gridTop + headerHeight + padding + 14

    const sections = showSubHeadings ? groupBySection(colItems, categories) : [{category: null, items: colItems}]

    for (const section of sections) {
      // Sub-header (only if we're showing sub-headings and this isn't an empty fallback).
      if (showSubHeadings && section.items.length > 0) {
        if (itemY + lineHeight > gridBottom - padding) break
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(fontSize)
        doc.setTextColor(110, 110, 110)
        const subHeading = section.category
          ? `${section.category.icon ? `${section.category.icon} ` : ''}${section.category.name}`.toUpperCase()
          : 'UNCATEGORIZED'
        const truncated = doc.splitTextToSize(subHeading, textMaxWidth + CHECKBOX_SIZE)[0]
        doc.text(truncated, x + padding, itemY)
        itemY += lineHeight
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(fontSize)
      doc.setTextColor(0, 0, 0)
      for (const item of section.items) {
        const lines = doc.splitTextToSize(item.title, textMaxWidth) as string[]
        const blockHeight = Math.max(ROW_HEIGHT - 2, lines.length * lineHeight + 4)
        if (itemY + blockHeight > gridBottom - padding) break
        drawCheckbox(doc, x + padding, itemY - CHECKBOX_SIZE + 2, CHECKBOX_SIZE - 2)
        for (let li = 0; li < lines.length; li++) {
          doc.text(lines[li], textX, itemY + li * lineHeight)
        }
        itemY += blockHeight
      }
    }
  }

  doc.save(filename(view))
}

function groupForKanban(items: PeriodItem[]): {unassigned: PeriodItem[]; byDay: PeriodItem[][]} {
  const byDay: PeriodItem[][] = [[], [], [], [], [], [], []]
  const unassigned: PeriodItem[] = []
  for (const it of items) {
    if (it.dayOfWeek == null) unassigned.push(it)
    else byDay[it.dayOfWeek].push(it)
  }
  return {unassigned, byDay}
}

// ---------------- Helpers ----------------

function drawCheckbox(doc: jsPDF, x: number, y: number, size = CHECKBOX_SIZE): void {
  doc.setDrawColor(80, 80, 80)
  doc.setLineWidth(0.8)
  doc.rect(x, y, size, size, 'S')
}

function rangeLabel(view: PeriodView): string {
  if (view.frequency === 'daily') return formatDayLabel(view.date)
  return `${formatDateLabel(view.range.startISO)} – ${formatDateLabel(view.range.endISO)}`
}

function filename(view: PeriodView): string {
  return `checkmate-${view.frequency}-${view.date}.pdf`
}
