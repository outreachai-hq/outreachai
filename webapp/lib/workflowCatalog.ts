// lib/workflowCatalog.ts
// Static catalogue of available triggers and actions — used by the API and the UI.

export const TRIGGERS = [
  { key: 'lead.replied',              label: 'Lead replied to email',          description: 'Fires when a lead replies to a sequence email',        payloadFields: ['leadId','campaignId'] },
  { key: 'lead.email_opened',         label: 'Lead opened an email',           description: 'Fires when a lead opens a tracked email',              payloadFields: ['leadId','campaignId','openCount'] },
  { key: 'lead.email_clicked',        label: 'Lead clicked a link',            description: 'Fires when a lead clicks a tracked link',              payloadFields: ['leadId','campaignId','url'] },
  { key: 'conversation.reply_received', label: 'New inbound message',          description: 'Fires when a reply is received in any channel',        payloadFields: ['conversationId','channel','leadId'] },
  { key: 'deal.created',              label: 'Deal created',                   description: 'Fires when a new deal is added to the pipeline',       payloadFields: ['dealId','pipelineId','stageId'] },
  { key: 'deal.stage_changed',        label: 'Deal stage changed',             description: 'Fires when a deal moves to a new stage',               payloadFields: ['dealId','fromStageId','toStageId'] },
  { key: 'deal.won',                  label: 'Deal marked Won',                description: 'Fires when a deal is marked as won',                   payloadFields: ['dealId','value'] },
  { key: 'deal.lost',                 label: 'Deal marked Lost',               description: 'Fires when a deal is marked as lost',                  payloadFields: ['dealId','lostReason'] },
  { key: 'deal.close_date_passed',    label: 'Deal close date passed',         description: 'Daily check: deal not closed past its close date',     payloadFields: ['dealId'] },
  { key: 'booking.confirmed',         label: 'Meeting booked',                 description: 'Fires when a prospect books a meeting',                payloadFields: ['bookingId','guestEmail','startAt'] },
  { key: 'task.completed',            label: 'Task completed',                 description: 'Fires when a task is marked done',                     payloadFields: ['taskId','leadId'] },
  { key: 'task.overdue',              label: 'Task overdue',                   description: 'Daily check: task past its due date',                  payloadFields: ['taskId','leadId'] },
  { key: 'signal.fired',              label: 'Signal agent fired',             description: 'Fires when a watchlist detects a buying signal',       payloadFields: ['signalId','watchlistId','leadId'] },
]

export const ACTIONS = [
  { key: 'lead.add_tag',           label: 'Add tag to lead',          description: 'Adds a tag to the lead',                    configFields: [{ name: 'tag', type: 'text', label: 'Tag', required: true }] },
  { key: 'lead.remove_tag',        label: 'Remove tag from lead',     description: 'Removes a tag from the lead',               configFields: [{ name: 'tag', type: 'text', label: 'Tag', required: true }] },
  { key: 'lead.update_status',     label: 'Update lead status',       description: 'Sets the lead status',                      configFields: [{ name: 'status', type: 'select', label: 'Status', options: ['pending','in_progress','replied','completed'], required: true }] },
  { key: 'deal.create',            label: 'Create deal in pipeline',  description: 'Creates a new deal in your pipeline',       configFields: [{ name: 'stageId', type: 'stage_picker', label: 'Stage', required: false }, { name: 'title', type: 'text', label: 'Deal title (optional)', required: false }] },
  { key: 'deal.change_stage',      label: 'Move deal to stage',       description: 'Changes the deal to a different stage',     configFields: [{ name: 'stageId', type: 'stage_picker', label: 'Stage', required: true }] },
  { key: 'deal.mark_won',          label: 'Mark deal as Won',         description: 'Marks the deal as Won',                     configFields: [] },
  { key: 'deal.mark_lost',         label: 'Mark deal as Lost',        description: 'Marks the deal as Lost',                    configFields: [{ name: 'reason', type: 'text', label: 'Lost reason (optional)', required: false }] },
  { key: 'task.create',            label: 'Create a task',            description: 'Creates a follow-up task',                  configFields: [{ name: 'title', type: 'text', label: 'Task title', required: true }, { name: 'type', type: 'select', label: 'Type', options: ['call','email','linkedin','custom'], required: false }, { name: 'dueDaysFromNow', type: 'number', label: 'Due in (days)', required: false }] },
  { key: 'conversation.add_label', label: 'Label the conversation',   description: 'Adds a label to the inbox conversation',    configFields: [{ name: 'label', type: 'text', label: 'Label key', required: true }] },
  { key: 'conversation.mark_done', label: 'Archive conversation',     description: 'Marks the conversation as done',            configFields: [] },
  { key: 'notify.webhook',         label: 'Send webhook',             description: 'POST to a URL (Slack, Zapier, etc.)',        configFields: [{ name: 'url', type: 'url', label: 'Webhook URL', required: true }] },
]
