import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import AccessibleModal from './AccessibleModal'
import BigBossName from './BigBossName'
import { useAuth } from '../contexts/AuthContext'
import { isPlatformAdmin } from '../utils/tournamentUser'
import {
  describeRoleplayAction,
  recordBigBossActivity,
  roleplayAuthorizationNumber,
} from '../utils/bigBossRoleplay'

const ACTIONABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type PendingAction =
  | { kind: 'click'; target: HTMLElement; label: string }
  | { kind: 'submit'; form: HTMLFormElement; submitter: HTMLElement | null; label: string }

type BigBossPermissionGateProps = {
  enabled: boolean
}

const BigBossPermissionGate = ({ enabled }: BigBossPermissionGateProps) => {
  const { user, loading: authLoading } = useAuth()
  const [pending, setPending] = useState<PendingAction | null>(null)
  const replayClickRef = useRef(new WeakSet<HTMLElement>())
  const replaySubmitRef = useRef(new WeakSet<HTMLFormElement>())
  const countedSubmitRef = useRef(new WeakSet<HTMLFormElement>())
  const exempt = isPlatformAdmin(user)

  useEffect(() => {
    if (!enabled || authLoading || exempt) return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      const origin = event.target
      if (!(origin instanceof Element)) return
      if (origin.closest('[data-roleplay-bypass], .big-boss-modal')) return

      const target = origin.closest<HTMLElement>(ACTIONABLE_SELECTOR)
      if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') {
        return
      }
      if (target instanceof HTMLSelectElement && typeof target.showPicker !== 'function') return
      if (replayClickRef.current.delete(target)) return

      if (!recordBigBossActivity()) {
        const submitControl =
          target instanceof HTMLButtonElement || target instanceof HTMLInputElement
            ? target
            : null
        if (submitControl?.form && submitControl.type === 'submit') {
          const form = submitControl.form
          countedSubmitRef.current.add(form)
          queueMicrotask(() => countedSubmitRef.current.delete(form))
        }
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setPending({ kind: 'click', target, label: describeRoleplayAction(target) })
    }

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      if (form.closest('[data-roleplay-bypass], .big-boss-modal')) return
      if (replaySubmitRef.current.delete(form)) return
      if (countedSubmitRef.current.delete(form)) return
      if (!recordBigBossActivity()) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null
      setPending({
        kind: 'submit',
        form,
        submitter,
        label: submitter ? describeRoleplayAction(submitter) : 'שליחת טופס',
      })
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [authLoading, enabled, exempt])

  const authorizationNumber = useMemo(
    () => roleplayAuthorizationNumber(pending?.label ?? ''),
    [pending?.label]
  )

  const approve = () => {
    const approved = pending
    if (!approved) return
    flushSync(() => setPending(null))

    if (approved.kind === 'submit') {
      if (!approved.form.isConnected) return
      replaySubmitRef.current.add(approved.form)
      approved.form.requestSubmit(
        approved.submitter instanceof HTMLButtonElement ||
          approved.submitter instanceof HTMLInputElement
          ? approved.submitter
          : undefined
      )
      return
    }

    const target = approved.target
    if (!target.isConnected) return

    if (target instanceof HTMLSelectElement) {
      target.focus({ preventScroll: true })
      if (typeof target.showPicker === 'function') {
        try {
          target.showPicker()
          return
        } catch {
          /* Fall through so the next trusted click opens the native picker. */
        }
      }
      replayClickRef.current.add(target)
      return
    }

    if (
      target instanceof HTMLInputElement &&
      ['file', 'date', 'datetime-local', 'month', 'time', 'week', 'color'].includes(target.type)
    ) {
      target.focus({ preventScroll: true })
      if (typeof target.showPicker === 'function') {
        try {
          target.showPicker()
          return
        } catch {
          /* Fall back to a synchronous click within the approval activation. */
        }
      }
      replayClickRef.current.add(target)
      target.click()
      return
    }

    if (
      target instanceof HTMLInputElement &&
      !['button', 'checkbox', 'radio', 'reset', 'submit'].includes(target.type)
    ) {
      target.focus({ preventScroll: true })
      return
    }

    if (target instanceof HTMLTextAreaElement) {
      target.focus({ preventScroll: true })
      return
    }

    const submitControl =
      target instanceof HTMLButtonElement || target instanceof HTMLInputElement
        ? target
        : null
    if (submitControl?.form && submitControl.type === 'submit') {
      replaySubmitRef.current.add(submitControl.form)
    }
    replayClickRef.current.add(target)
    target.click()
  }

  return (
    <AccessibleModal
      open={pending !== null && !authLoading && !exempt}
      onClose={() => setPending(null)}
      titleId="big-boss-permission-title"
      className="big-boss-modal"
      dialogClassName="big-boss-dialog"
      centered={false}
    >
      <div className="big-boss-dialog__panel" data-roleplay-bypass>
        <p className="big-boss-dialog__eyebrow">תיק פעילות חריגה {authorizationNumber}</p>
        <h2 id="big-boss-permission-title">זוהתה פעילות חשודה</h2>
        <p className="big-boss-dialog__action">
          הפעולה המבוקשת:
          <br />
          <strong>{pending?.label}</strong>
        </p>
        <p>האם הפעילות הזאת מוכרת ומאושרת על ידי</p>
        <BigBossName stacked />
        <div className="big-boss-dialog__actions">
          <button
            type="button"
            className="btn big-boss-dialog__primary"
            onClick={approve}
            data-roleplay-bypass
          >
            כן, הפעילות מאושרת
          </button>
          <button
            type="button"
            className="btn big-boss-dialog__secondary"
            onClick={() => setPending(null)}
            data-roleplay-bypass
          >
            לא, אבטל את הפעולה
          </button>
        </div>
      </div>
    </AccessibleModal>
  )
}

export default BigBossPermissionGate
