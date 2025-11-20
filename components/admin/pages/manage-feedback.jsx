"use client"

import { useState, useEffect, useMemo } from "react"
import { Star, Eye, CheckCircle, XCircle, Loader2, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

export default function ManageFeedback() {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [deleteFeedback, setDeleteFeedback] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [sortBy, setSortBy] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const isMobile = useIsMobile()
  const ITEMS_PER_PAGE = 10

  // Fetch feedbacks from Firestore
  useEffect(() => {
    const feedbacksRef = collection(db, "feedbacks")
    const q = query(feedbacksRef, orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const feedbacksData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setFeedbacks(feedbacksData)
        setLoading(false)
      },
      (error) => {
        console.error("Error fetching feedbacks:", error)
        toast.error("Failed to load feedbacks")
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleStatusChange = async (feedbackId, currentStatus) => {
    if (processingId) return
    
    setProcessingId(feedbackId)
    
    try {
      const feedbackRef = doc(db, "feedbacks", feedbackId)
      const newStatus = currentStatus === "Published" ? "Hidden" : "Published"
      
      await updateDoc(feedbackRef, {
        status: newStatus,
      })
      
      toast.success(`Feedback ${newStatus === "Published" ? "published" : "hidden"}`)
    } catch (error) {
      console.error("Error updating feedback status:", error)
      toast.error("Failed to update feedback status")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteClick = (feedback) => {
    setDeleteFeedback(feedback)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteFeedback || processingId) return
    
    setProcessingId(deleteFeedback.id)
    
    try {
      const feedbackRef = doc(db, "feedbacks", deleteFeedback.id)
      await deleteDoc(feedbackRef)
      
      toast.success("Feedback deleted successfully")
      setDeleteFeedback(null)
    } catch (error) {
      console.error("Error deleting feedback:", error)
      toast.error("Failed to delete feedback")
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
      case "Published":
        return "bg-green-100 text-green-800"
      case "Hidden":
        return "bg-gray-100 text-gray-800"
      case "Pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Sort and filter feedbacks
  const sortedAndFilteredFeedbacks = useMemo(() => {
    let filtered = [...feedbacks]

    // Filter by status
    if (sortBy !== "all") {
      filtered = filtered.filter((feedback) => {
        const status = feedback.status || "Pending"
        return status === sortBy
      })
    }

    // Sort: Published first, then by date (newest first)
    filtered.sort((a, b) => {
      const statusA = a.status || "Pending"
      const statusB = b.status || "Pending"
      
      // Published feedbacks first
      if (statusA === "Published" && statusB !== "Published") return -1
      if (statusA !== "Published" && statusB === "Published") return 1
      
      // Then sort by date (newest first)
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
      return dateB - dateA
    })

    return filtered
  }, [feedbacks, sortBy])

  // Pagination calculations
  const totalPages = Math.ceil(sortedAndFilteredFeedbacks.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedFeedbacks = sortedAndFilteredFeedbacks.slice(startIndex, endIndex)

  // Reset to page 1 when sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy])

  // Skeleton loading component
  const SkeletonRow = () => (
    <tr className="border-b border-border">
      <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-40" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-20" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-48" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-28" /></td>
      <td className="py-4 px-6"><Skeleton className="h-6 w-20 rounded-full" /></td>
      <td className="py-4 px-6"><Skeleton className="h-8 w-28" /></td>
    </tr>
  )

  const MobileSkeletonCard = () => (
    <div className="bg-card rounded-xl shadow-lg p-4 border border-border">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground">Manage Feedbacks</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
              <SelectItem value="Hidden">Hidden</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedAndFilteredFeedbacks.length === 0 ? (
        <div className="bg-card rounded-xl shadow-lg p-8 text-center">
          <Star className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No feedbacks found.</p>
        </div>
      ) : isMobile ? (
        // Mobile View: Card layout, no scroll bar
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <MobileSkeletonCard key={i} />)
          ) : (
            paginatedFeedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className={`bg-card rounded-xl shadow-lg p-4 border border-border hover:shadow-xl transition-shadow ${
                  feedback.status === "Hidden" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{feedback.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{feedback.email}</p>
                    <div className="flex gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={
                            i < (feedback.rating || 0)
                              ? "fill-amber-500 text-amber-500"
                              : "text-gray-300"
                          }
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">({feedback.rating || 0}/5)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{feedback.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(feedback.status)}`}>
                        {feedback.status || "Pending"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(feedback.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleStatusChange(feedback.id, feedback.status)}
                      disabled={processingId === feedback.id}
                      className={`p-2 rounded-lg hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        feedback.status === "Published"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-green-100 text-green-800"
                      }`}
                      title={feedback.status === "Published" ? "Hide Feedback" : "Publish Feedback"}
                    >
                      {processingId === feedback.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : feedback.status === "Published" ? (
                        <XCircle size={18} />
                      ) : (
                        <CheckCircle size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedFeedback(feedback)}
                      className="p-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(feedback)}
                      disabled={processingId === feedback.id}
                      className="p-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Feedback"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Desktop View: Table
        <div className="bg-card rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Rating</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Message Preview</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Date</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                ) : (
                  paginatedFeedbacks.map((feedback) => (
                  <tr
                    key={feedback.id}
                    className={`border-b border-border hover:bg-secondary/10 ${
                      feedback.status === "Hidden" ? "opacity-60" : ""
                    }`}
                  >
                    <td className="py-4 px-6 text-foreground font-semibold">{feedback.name}</td>
                    <td className="py-4 px-6 text-foreground text-xs">{feedback.email}</td>
                    <td className="py-4 px-6">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={
                              i < (feedback.rating || 0)
                                ? "fill-amber-500 text-amber-500"
                                : "text-gray-300"
                            }
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground">
                      <div className="max-w-xs truncate">{feedback.message}</div>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground text-xs">
                      {formatDate(feedback.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          feedback.status
                        )}`}
                      >
                        {feedback.status || "Pending"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(feedback.id, feedback.status)}
                          disabled={processingId === feedback.id}
                          className={`p-2 rounded hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                            feedback.status === "Published"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-green-100 text-green-800"
                          }`}
                          title={feedback.status === "Published" ? "Hide Feedback" : "Publish Feedback"}
                        >
                          {processingId === feedback.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : feedback.status === "Published" ? (
                            <XCircle size={16} />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedFeedback(feedback)}
                          className="p-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(feedback)}
                          disabled={processingId === feedback.id}
                          className="p-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Feedback"
                        >
                          <Trash2 size={16} />
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
      {sortedAndFilteredFeedbacks.length > ITEMS_PER_PAGE && (
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
      {sortedAndFilteredFeedbacks.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(endIndex, sortedAndFilteredFeedbacks.length)} of {sortedAndFilteredFeedbacks.length} feedbacks
        </div>
      )}

      {/* Feedback Details Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className={`${isMobile ? 'max-w-[90%] w-[90%] max-h-[85vh] p-4' : 'max-w-2xl max-h-[90vh] p-6'} overflow-y-auto`}>
          <DialogHeader className={isMobile ? 'pb-2' : ''}>
            <DialogTitle className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-foreground`}>Feedback Details</DialogTitle>
            {!isMobile && (
              <DialogDescription className="text-muted-foreground">
                View and manage feedback details
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedFeedback && (
            <div className={`space-y-3 ${isMobile ? 'mt-1' : 'mt-4'}`}>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
                <div>
                  <p className={`text-muted-foreground mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Name</p>
                  <p className={`font-semibold text-foreground ${isMobile ? 'text-xs' : ''}`}>{selectedFeedback.name}</p>
                </div>
                <div>
                  <p className={`text-muted-foreground mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Email</p>
                  <p className={`font-semibold text-foreground ${isMobile ? 'text-[10px]' : 'text-sm'} break-all`}>{selectedFeedback.email}</p>
                </div>
              </div>
              <div>
                <p className={`text-muted-foreground mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Rating</p>
                <div className={`flex gap-1 ${isMobile ? 'mt-1' : 'mt-2'}`}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={isMobile ? 14 : 20}
                      className={
                        i < (selectedFeedback.rating || 0)
                          ? "fill-amber-500 text-amber-500"
                          : "text-gray-300"
                      }
                    />
                  ))}
                  <span className={`${isMobile ? 'ml-1 text-xs' : 'ml-2'} text-foreground`}>({selectedFeedback.rating || 0}/5)</span>
                </div>
              </div>
              <div>
                <p className={`text-muted-foreground mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Date</p>
                <p className={`font-semibold text-foreground ${isMobile ? 'text-xs' : ''}`}>{formatDate(selectedFeedback.createdAt)}</p>
              </div>
              <div>
                <p className={`text-muted-foreground mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Status</p>
                <span
                  className={`px-2 py-0.5 rounded-full ${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold inline-block ${getStatusColor(
                    selectedFeedback.status
                  )}`}
                >
                  {selectedFeedback.status || "Pending"}
                </span>
              </div>
              <div>
                <p className={`text-muted-foreground mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Message</p>
                <div className={`bg-secondary/30 rounded-lg ${isMobile ? 'p-2 text-xs' : 'p-4'} text-foreground whitespace-pre-wrap`}>
                  {selectedFeedback.message}
                </div>
              </div>
              <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-row gap-2'} pt-2`}>
                <Button
                  onClick={() => {
                    handleStatusChange(selectedFeedback.id, selectedFeedback.status)
                    setSelectedFeedback(null)
                  }}
                  variant={selectedFeedback.status === "Published" ? "outline" : "default"}
                  className={`${isMobile ? 'w-full text-xs py-1.5' : 'flex-1'}`}
                >
                  {selectedFeedback.status === "Published" ? "Hide Feedback" : "Publish Feedback"}
                </Button>
                <Button
                  onClick={() => setSelectedFeedback(null)}
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

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteFeedback} onOpenChange={(open) => !open && setDeleteFeedback(null)}>
        <AlertDialogContent className={`${isMobile ? 'max-w-[90%] w-[90%]' : 'max-w-md'}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Feedback
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback from <strong>{deleteFeedback?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <AlertDialogCancel
              onClick={() => setDeleteFeedback(null)}
              className={isMobile ? 'w-full' : ''}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={processingId === deleteFeedback?.id}
              className={`bg-red-600 hover:bg-red-700 text-white ${isMobile ? 'w-full' : ''}`}
            >
              {processingId === deleteFeedback?.id ? (
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
