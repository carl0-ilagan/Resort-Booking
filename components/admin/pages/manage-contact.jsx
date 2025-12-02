"use client"

import { useState, useEffect, useMemo } from "react"
import { Mail, Eye, CheckCircle, XCircle, Loader2, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

export default function ManageContact() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [deleteMessage, setDeleteMessage] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [sortBy, setSortBy] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const isMobile = useIsMobile()
  const ITEMS_PER_PAGE = 10

  // Fetch contact messages from Firestore
  useEffect(() => {
    const messagesRef = collection(db, "contactMessages")
    const q = query(messagesRef, orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setMessages(messagesData)
        setLoading(false)
      },
      (error) => {
        console.error("Error fetching contact messages:", error)
        toast.error("Failed to load contact messages")
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleMarkAsRead = async (messageId, currentStatus) => {
    if (processingId) return
    
    setProcessingId(messageId)
    
    try {
      const messageRef = doc(db, "contactMessages", messageId)
      await updateDoc(messageRef, {
        status: currentStatus === "Read" ? "Unread" : "Read",
      })
      
      toast.success(`Message marked as ${currentStatus === "Read" ? "Unread" : "Read"}`)
    } catch (error) {
      console.error("Error updating message status:", error)
      toast.error("Failed to update message status")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteClick = (message) => {
    setDeleteMessage(message)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteMessage || processingId) return
    
    setProcessingId(deleteMessage.id)
    
    try {
      const messageRef = doc(db, "contactMessages", deleteMessage.id)
      await deleteDoc(messageRef)
      
      toast.success("Message deleted successfully")
      setDeleteMessage(null)
    } catch (error) {
      console.error("Error deleting message:", error)
      toast.error("Failed to delete message")
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A"
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      }
      return new Date(timestamp).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "N/A"
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "Read":
        return "bg-blue-100 text-blue-800"
      case "Replied":
        return "bg-green-100 text-green-800"
      case "Unread":
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  // Sort and filter messages
  const sortedAndFilteredMessages = useMemo(() => {
    let filtered = [...messages]

    // Filter by status
    if (sortBy !== "all") {
      filtered = filtered.filter((message) => {
        const status = message.status || "Unread"
        return status === sortBy
      })
    }

    // Sort: Unread first, then by date (newest first)
    filtered.sort((a, b) => {
      const statusA = a.status || "Unread"
      const statusB = b.status || "Unread"
      
      // Unread messages first
      if (statusA === "Unread" && statusB !== "Unread") return -1
      if (statusA !== "Unread" && statusB === "Unread") return 1
      
      // Then sort by date (newest first)
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
      return dateB - dateA
    })

    return filtered
  }, [messages, sortBy])

  // Pagination calculations
  const totalPages = Math.ceil(sortedAndFilteredMessages.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedMessages = sortedAndFilteredMessages.slice(startIndex, endIndex)

  // Reset to page 1 when sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy])

  // Skeleton loading component
  const SkeletonRow = () => (
    <tr className="border-b border-border dark:border-slate-700">
      <td className="py-4 px-6"><Skeleton className="h-4 w-32 dark:bg-slate-700" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-40 dark:bg-slate-700" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-48 dark:bg-slate-700" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-28 dark:bg-slate-700" /></td>
      <td className="py-4 px-6"><Skeleton className="h-6 w-20 rounded-full dark:bg-slate-700" /></td>
      <td className="py-4 px-6"><Skeleton className="h-8 w-20 dark:bg-slate-700" /></td>
    </tr>
  )

  const MobileSkeletonCard = () => (
    <div className="bg-card dark:bg-slate-800 rounded-xl shadow-lg p-4 border border-border dark:border-slate-700">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-32 dark:bg-slate-700" />
          <Skeleton className="h-3 w-40 dark:bg-slate-700" />
          <Skeleton className="h-3 w-48 dark:bg-slate-700" />
          <Skeleton className="h-5 w-16 rounded-full dark:bg-slate-700" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-10 w-10 rounded-lg dark:bg-slate-700" />
          <Skeleton className="h-10 w-10 rounded-lg dark:bg-slate-700" />
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-white">Contact Messages</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground dark:text-gray-400 whitespace-nowrap">Sort by:</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Messages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="Unread">Unread</SelectItem>
              <SelectItem value="Read">Read</SelectItem>
              <SelectItem value="Replied">Replied</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedAndFilteredMessages.length === 0 ? (
        <div className="bg-card dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
          <Mail className="h-16 w-16 text-muted-foreground dark:text-gray-500 mx-auto mb-4" />
          <p className="text-muted-foreground dark:text-gray-400">No contact messages found.</p>
        </div>
      ) : isMobile ? (
        // Mobile View: Card layout, no scroll bar
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <MobileSkeletonCard key={i} />)
          ) : (
            paginatedMessages.map((message) => (
              <div
                key={message.id}
                className={`bg-card dark:bg-slate-800 rounded-xl shadow-lg p-4 border border-border dark:border-slate-700 hover:shadow-xl transition-shadow ${
                  message.status === "Unread" ? "bg-yellow-50/50 dark:bg-yellow-900/20" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground dark:text-white truncate">{message.name}</h3>
                    <p className="text-xs text-muted-foreground dark:text-gray-400 truncate">{message.email}</p>
                    <p className="text-sm text-muted-foreground dark:text-gray-300 mt-1 line-clamp-2">{message.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(message.status)}`}>
                        {message.status || "Unread"}
                      </span>
                      <span className="text-xs text-muted-foreground dark:text-gray-400">{formatDate(message.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleMarkAsRead(message.id, message.status)}
                      disabled={processingId === message.id}
                      className={`p-2 rounded-lg hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        message.status === "Read"
                          ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                          : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300"
                      }`}
                      title={message.status === "Read" ? "Mark as Unread" : "Mark as Read"}
                    >
                      {processingId === message.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : message.status === "Read" ? (
                        <XCircle size={18} />
                      ) : (
                        <CheckCircle size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedMessage(message)}
                      className="p-2 bg-secondary dark:bg-slate-700 text-secondary-foreground dark:text-white rounded-lg hover:bg-secondary/80 dark:hover:bg-slate-600 transition"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(message)}
                      disabled={processingId === message.id}
                      className="p-2 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Message"
                    >
                      {processingId === message.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Desktop View: Table
        <div className="bg-card dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 dark:bg-slate-700/50 border-b border-border dark:border-slate-600">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-foreground dark:text-white">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground dark:text-white">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground dark:text-white">Message Preview</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground dark:text-white">Date</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground dark:text-white">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                ) : (
                  paginatedMessages.map((message) => (
                  <tr
                    key={message.id}
                    className={`border-b border-border dark:border-slate-700 hover:bg-secondary/10 dark:hover:bg-slate-700/30 ${
                      message.status === "Unread" ? "bg-yellow-50/50 dark:bg-yellow-900/20" : "dark:bg-slate-800/50"
                    }`}
                  >
                    <td className="py-4 px-6 text-foreground dark:text-white font-semibold">{message.name}</td>
                    <td className="py-4 px-6 text-foreground dark:text-gray-300 text-xs">{message.email}</td>
                    <td className="py-4 px-6 text-muted-foreground dark:text-gray-300">
                      <div className="max-w-xs truncate">{message.message}</div>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground dark:text-gray-400 text-xs">
                      {formatDate(message.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          message.status
                        )}`}
                      >
                        {message.status || "Unread"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkAsRead(message.id, message.status)}
                          disabled={processingId === message.id}
                          className={`p-2 rounded hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            message.status === "Read"
                              ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                              : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300"
                          }`}
                          title={message.status === "Read" ? "Mark as Unread" : "Mark as Read"}
                        >
                          {processingId === message.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : message.status === "Read" ? (
                            <XCircle size={16} />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedMessage(message)}
                          className="p-2 bg-secondary dark:bg-slate-700 text-secondary-foreground dark:text-white rounded hover:bg-secondary/80 dark:hover:bg-slate-600 transition"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(message)}
                          disabled={processingId === message.id}
                          className="p-2 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/70 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Message"
                        >
                          {processingId === message.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {sortedAndFilteredMessages.length > ITEMS_PER_PAGE && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(page)
                        }}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <span className="px-2">...</span>
                    </PaginationItem>
                  )
                }
                return null
              })}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Show pagination info */}
      {sortedAndFilteredMessages.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground dark:text-gray-400">
          Showing {startIndex + 1} to {Math.min(endIndex, sortedAndFilteredMessages.length)} of {sortedAndFilteredMessages.length} messages
        </div>
      )}

      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className={`${isMobile ? 'max-w-[90%] w-[90%] max-h-[85vh] p-4' : 'max-w-2xl max-h-[90vh] p-6'} overflow-y-auto dark:bg-slate-800 dark:border-slate-700`}>
          <DialogHeader className={isMobile ? 'pb-2' : ''}>
            <DialogTitle className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-foreground dark:text-white`}>Message Details</DialogTitle>
            {!isMobile && (
              <DialogDescription className="text-muted-foreground dark:text-gray-400">
                View and manage contact message details
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedMessage && (
            <div className={`space-y-3 ${isMobile ? 'mt-1' : 'mt-4'}`}>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
                <div>
                  <p className={`text-muted-foreground dark:text-gray-400 mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Name</p>
                  <p className={`font-semibold text-foreground dark:text-white ${isMobile ? 'text-xs' : ''}`}>{selectedMessage.name}</p>
                </div>
                <div>
                  <p className={`text-muted-foreground dark:text-gray-400 mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Email</p>
                  <p className={`font-semibold text-foreground dark:text-white ${isMobile ? 'text-[10px]' : 'text-sm'} break-all`}>{selectedMessage.email}</p>
                </div>
              </div>
              <div>
                <p className={`text-muted-foreground dark:text-gray-400 mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Date</p>
                <p className={`font-semibold text-foreground dark:text-white ${isMobile ? 'text-xs' : ''}`}>{formatDate(selectedMessage.createdAt)}</p>
              </div>
              <div>
                <p className={`text-muted-foreground dark:text-gray-400 mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Status</p>
                <span
                  className={`px-2 py-0.5 rounded-full ${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold inline-block ${getStatusColor(
                    selectedMessage.status
                  )}`}
                >
                  {selectedMessage.status || "Unread"}
                </span>
              </div>
              <div>
                <p className={`text-muted-foreground dark:text-gray-400 mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Message</p>
                <div className={`bg-secondary/30 dark:bg-slate-700/50 rounded-lg ${isMobile ? 'p-2 text-xs' : 'p-4'} text-foreground dark:text-gray-200 whitespace-pre-wrap`}>
                  {selectedMessage.message}
                </div>
              </div>
              <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-row gap-2'} pt-2`}>
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: Your Contact Message&body=Dear ${selectedMessage.name},%0D%0A%0D%0A`}
                  className={`${isMobile ? 'w-full text-xs py-1.5' : 'flex-1 py-2'} bg-primary hover:bg-primary/90 text-primary-foreground px-4 rounded-lg text-center transition`}
                >
                  Reply via Email
                </a>
                <Button
                  onClick={() => setSelectedMessage(null)}
                  variant="outline"
                  className={`${isMobile ? 'w-full text-xs py-1.5' : 'flex-1'}`}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteMessage} onOpenChange={(open) => !open && setDeleteMessage(null)}>
        <AlertDialogContent className={`${isMobile ? 'max-w-[90%] w-[90%]' : 'max-w-md'}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Message
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message from <strong>{deleteMessage?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <AlertDialogCancel
              onClick={() => setDeleteMessage(null)}
              className={isMobile ? 'w-full' : ''}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={processingId === deleteMessage?.id}
              className={`bg-red-600 hover:bg-red-700 text-white ${isMobile ? 'w-full' : ''}`}
            >
              {processingId === deleteMessage?.id ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

