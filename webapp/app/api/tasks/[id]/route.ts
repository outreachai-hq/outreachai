import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Activity } from '@/lib/activity'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(body.completedAt !== undefined && { completedAt: body.completedAt ? new Date(body.completedAt) : null }),
      ...(body.dueAt !== undefined && { dueAt: body.dueAt ? new Date(body.dueAt) : null }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  })

  // Activity timeline — a transition from incomplete -> completed.
  if (body.completedAt && !task.completedAt) {
    Activity.taskCompleted({
      userId: session.user.id,
      leadId: task.leadId ?? undefined,
      taskId: task.id,
      title: updated.title,
      actorUserId: session.user.id,
    }).catch(() => {})
    runWorkflowsForEvent('task.completed', session.user.id, {
      taskId: id, leadId: task.leadId ?? undefined,
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.task.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
